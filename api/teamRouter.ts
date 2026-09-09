import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  auditLogs,
  detectionHits,
  orgMembers,
  organizations,
  reviewAnnotations,
  reviewAssignments,
  submissions,
  users,
} from "@db/schema";
import { authedQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";

/** 写审计日志（组织内关键动作留痕，供合规自查备查） */
async function audit(
  orgId: number,
  userId: number,
  action: string,
  targetType = "",
  targetId?: number,
  detail?: Record<string, unknown>,
) {
  const db = getDb();
  await db.insert(auditLogs).values({ orgId, userId, action, targetType, targetId, detail });
}

/** 校验当前用户是组织成员，返回成员角色 */
async function requireMembership(orgId: number, userId: number) {
  const db = getDb();
  const [m] = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
  if (!m) {
    throw new TRPCError({ code: "FORBIDDEN", message: "您不是该组织成员" });
  }
  return m;
}

/** 校验当前用户是 owner 或 reviewer（管理类动作） */
async function requireManager(orgId: number, userId: number) {
  const m = await requireMembership(orgId, userId);
  if (m.role !== "owner" && m.role !== "reviewer") {
    throw new TRPCError({ code: "FORBIDDEN", message: "仅负责人/审核员可执行该操作" });
  }
  return m;
}

/**
 * 团队协作审核流（一期）：组织管理 + 工单指派 + 复核批注 + 审计日志。
 * 对应广电对微短剧「先审后播、3名持证审核员」的自审要求，
 * 让制作公司内部完成「编剧提交 → 审核员复核 → 批注整改 → 通过/驳回」的留痕闭环。
 */
export const teamRouter = createRouter({
  // ---------- 组织 ----------

  /** 我所在的组织列表（含我的角色） */
  myOrgs: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select({
        id: organizations.id,
        name: organizations.name,
        ownerId: organizations.ownerId,
        createdAt: organizations.createdAt,
        myRole: orgMembers.role,
      })
      .from(orgMembers)
      .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
      .where(eq(orgMembers.userId, ctx.user.id))
      .orderBy(desc(organizations.createdAt));
  }),

  /** 创建组织（创建者自动成为 owner 成员） */
  createOrg: authedQuery
    .input(z.object({ name: z.string().min(2, "组织名称至少 2 个字").max(64) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const r = await db.insert(organizations).values({ name: input.name, ownerId: ctx.user.id });
      const orgId = Number(r[0].insertId);
      await db.insert(orgMembers).values({ orgId, userId: ctx.user.id, role: "owner" });
      await audit(orgId, ctx.user.id, "org.create", "organization", orgId, { name: input.name });
      return { ok: true, orgId };
    }),

  /** 成员列表（附用户信息） */
  listMembers: authedQuery
    .input(z.object({ orgId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireMembership(input.orgId, ctx.user.id);
      const db = getDb();
      return db
        .select({
          id: orgMembers.id,
          userId: orgMembers.userId,
          role: orgMembers.role,
          licenseNo: orgMembers.licenseNo,
          createdAt: orgMembers.createdAt,
          name: users.name,
          email: users.email,
        })
        .from(orgMembers)
        .leftJoin(users, eq(orgMembers.userId, users.id))
        .where(eq(orgMembers.orgId, input.orgId));
    }),

  /** 按邮箱邀请成员（对方需已注册登录过平台） */
  addMember: authedQuery
    .input(
      z.object({
        orgId: z.number().int().positive(),
        email: z.string().email("请填写对方注册邮箱"),
        role: z.enum(["reviewer", "editor"]).default("editor"),
        licenseNo: z.string().max(64).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireManager(input.orgId, ctx.user.id);
      const db = getDb();
      const [target] = await db.select().from(users).where(eq(users.email, input.email));
      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "该邮箱尚未注册平台账号" });
      }
      const [exist] = await db
        .select()
        .from(orgMembers)
        .where(and(eq(orgMembers.orgId, input.orgId), eq(orgMembers.userId, target.id)));
      if (exist) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "该用户已是组织成员" });
      }
      await db.insert(orgMembers).values({
        orgId: input.orgId,
        userId: target.id,
        role: input.role,
        licenseNo: input.licenseNo,
      });
      await audit(input.orgId, ctx.user.id, "member.add", "user", target.id, {
        email: input.email,
        role: input.role,
      });
      return { ok: true };
    }),

  /** 移除成员（不能移除 owner） */
  removeMember: authedQuery
    .input(z.object({ orgId: z.number().int().positive(), memberId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await requireManager(input.orgId, ctx.user.id);
      const db = getDb();
      const [m] = await db
        .select()
        .from(orgMembers)
        .where(and(eq(orgMembers.id, input.memberId), eq(orgMembers.orgId, input.orgId)));
      if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "成员不存在" });
      if (m.role === "owner") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "不能移除组织负责人" });
      }
      await db.delete(orgMembers).where(eq(orgMembers.id, input.memberId));
      await audit(input.orgId, ctx.user.id, "member.remove", "user", m.userId);
      return { ok: true };
    }),

  // ---------- 复核工单 ----------

  /** 发起复核：把自己名下的送检指派给组织内审核员 */
  createAssignment: authedQuery
    .input(
      z.object({
        orgId: z.number().int().positive(),
        submissionId: z.number().int().positive(),
        assigneeId: z.number().int().positive(),
        note: z.string().max(500).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireMembership(input.orgId, ctx.user.id);
      const db = getDb();
      // 只能指派本人提交的检测（防止把他人剧本内容泄露给组织）
      const [sub] = await db
        .select()
        .from(submissions)
        .where(eq(submissions.id, input.submissionId));
      if (!sub) throw new TRPCError({ code: "NOT_FOUND", message: "送检记录不存在" });
      if (sub.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "只能指派本人提交的检测" });
      }
      // 被指派人必须是组织成员
      await requireMembership(input.orgId, input.assigneeId);
      const r = await db.insert(reviewAssignments).values({
        orgId: input.orgId,
        submissionId: input.submissionId,
        assigneeId: input.assigneeId,
        assignedBy: ctx.user.id,
        note: input.note,
      });
      const assignmentId = Number(r[0].insertId);
      await audit(input.orgId, ctx.user.id, "assignment.create", "assignment", assignmentId, {
        submissionId: input.submissionId,
        assigneeId: input.assigneeId,
      });
      return { ok: true, assignmentId };
    }),

  /** 工单列表：mine=派给我的 / org=本组织全部（负责人/审核员可见） */
  listAssignments: authedQuery
    .input(
      z.object({
        orgId: z.number().int().positive(),
        scope: z.enum(["mine", "org"]).default("mine"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const m = await requireMembership(input.orgId, ctx.user.id);
      if (input.scope === "org" && m.role !== "owner" && m.role !== "reviewer") {
        throw new TRPCError({ code: "FORBIDDEN", message: "仅负责人/审核员可查看全部工单" });
      }
      const db = getDb();
      const cond =
        input.scope === "mine"
          ? and(
              eq(reviewAssignments.orgId, input.orgId),
              eq(reviewAssignments.assigneeId, ctx.user.id),
            )
          : eq(reviewAssignments.orgId, input.orgId);
      return db
        .select({
          id: reviewAssignments.id,
          submissionId: reviewAssignments.submissionId,
          status: reviewAssignments.status,
          note: reviewAssignments.note,
          createdAt: reviewAssignments.createdAt,
          completedAt: reviewAssignments.completedAt,
          workTitle: submissions.workTitle,
          verdict: submissions.verdict,
          assigneeId: reviewAssignments.assigneeId,
          assigneeName: users.name,
          assignedBy: reviewAssignments.assignedBy,
        })
        .from(reviewAssignments)
        .innerJoin(submissions, eq(reviewAssignments.submissionId, submissions.id))
        .leftJoin(users, eq(reviewAssignments.assigneeId, users.id))
        .where(cond)
        .orderBy(desc(reviewAssignments.createdAt));
    }),

  /** 工单详情：基本信息 + 命中条目 + 批注 */
  assignmentDetail: authedQuery
    .input(z.object({ assignmentId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [a] = await db
        .select()
        .from(reviewAssignments)
        .where(eq(reviewAssignments.id, input.assignmentId));
      if (!a) throw new TRPCError({ code: "NOT_FOUND", message: "工单不存在" });
      const m = await requireMembership(a.orgId, ctx.user.id);
      // 可见范围：被指派人 / 指派人 / 负责人与审核员
      const privileged = m.role === "owner" || m.role === "reviewer";
      if (!privileged && a.assigneeId !== ctx.user.id && a.assignedBy !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "无权查看该工单" });
      }
      const [sub] = await db.select().from(submissions).where(eq(submissions.id, a.submissionId));
      const hits = await db
        .select()
        .from(detectionHits)
        .where(eq(detectionHits.submissionId, a.submissionId));
      const annotations = await db
        .select({
          id: reviewAnnotations.id,
          hitId: reviewAnnotations.hitId,
          content: reviewAnnotations.content,
          createdAt: reviewAnnotations.createdAt,
          authorId: reviewAnnotations.authorId,
          authorName: users.name,
        })
        .from(reviewAnnotations)
        .leftJoin(users, eq(reviewAnnotations.authorId, users.id))
        .where(eq(reviewAnnotations.assignmentId, a.id))
        .orderBy(reviewAnnotations.createdAt);
      return { assignment: a, submission: sub, hits, annotations, myRole: m.role };
    }),

  /** 更新工单状态（仅被指派人或负责人/审核员）；开始复核自动置 in_review */
  updateAssignmentStatus: authedQuery
    .input(
      z.object({
        assignmentId: z.number().int().positive(),
        status: z.enum(["in_review", "approved", "rejected"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [a] = await db
        .select()
        .from(reviewAssignments)
        .where(eq(reviewAssignments.id, input.assignmentId));
      if (!a) throw new TRPCError({ code: "NOT_FOUND", message: "工单不存在" });
      const m = await requireMembership(a.orgId, ctx.user.id);
      const privileged = m.role === "owner" || m.role === "reviewer";
      if (!privileged && a.assigneeId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "仅被指派人或审核员可更新状态" });
      }
      const done = input.status === "approved" || input.status === "rejected";
      await db
        .update(reviewAssignments)
        .set({ status: input.status, completedAt: done ? new Date() : null })
        .where(eq(reviewAssignments.id, a.id));
      await audit(a.orgId, ctx.user.id, `assignment.${input.status}`, "assignment", a.id);
      return { ok: true };
    }),

  /** 添加批注（可针对具体命中条目 hitId，或不针对的整单批注） */
  addAnnotation: authedQuery
    .input(
      z.object({
        assignmentId: z.number().int().positive(),
        hitId: z.number().int().positive().optional(),
        content: z.string().min(1, "批注内容不能为空").max(1000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [a] = await db
        .select()
        .from(reviewAssignments)
        .where(eq(reviewAssignments.id, input.assignmentId));
      if (!a) throw new TRPCError({ code: "NOT_FOUND", message: "工单不存在" });
      await requireMembership(a.orgId, ctx.user.id);
      if (input.hitId) {
        const [hit] = await db
          .select()
          .from(detectionHits)
          .where(eq(detectionHits.id, input.hitId));
        if (!hit || hit.submissionId !== a.submissionId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "命中条目不属于该工单" });
        }
      }
      await db.insert(reviewAnnotations).values({
        assignmentId: a.id,
        hitId: input.hitId,
        authorId: ctx.user.id,
        content: input.content,
      });
      await audit(a.orgId, ctx.user.id, "annotation.add", "assignment", a.id, {
        hitId: input.hitId,
      });
      return { ok: true };
    }),

  // ---------- 审计日志 ----------

  /** 审计日志（仅负责人/审核员可查，倒序 100 条） */
  listAuditLogs: authedQuery
    .input(z.object({ orgId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      await requireManager(input.orgId, ctx.user.id);
      const db = getDb();
      return db
        .select({
          id: auditLogs.id,
          action: auditLogs.action,
          targetType: auditLogs.targetType,
          targetId: auditLogs.targetId,
          detail: auditLogs.detail,
          createdAt: auditLogs.createdAt,
          userId: auditLogs.userId,
          userName: users.name,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .where(eq(auditLogs.orgId, input.orgId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(100);
    }),

  /** 我可指派的送检列表（本人提交、已出结论的最近 50 条） */
  myAssignableSubmissions: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select({
        id: submissions.id,
        workTitle: submissions.workTitle,
        verdict: submissions.verdict,
        createdAt: submissions.createdAt,
      })
      .from(submissions)
      .where(and(eq(submissions.userId, ctx.user.id), sql`${submissions.verdict} IS NOT NULL`))
      .orderBy(desc(submissions.createdAt))
      .limit(50);
  }),
});
