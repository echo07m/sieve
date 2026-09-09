import { createHash } from "node:crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { detectionHits, reports, submissions, rules as rulesTable } from "@db/schema";
import { runDetection } from "./engine/orchestrator";
import {
  findHitsBySubmission,
  findReportBySubmission,
  findSubmissionById,
  findSubmissionsByUser,
  getActiveRules,
  getLatestRuleVersion,
} from "./queries/compliance";
import { and, eq } from "drizzle-orm";
import { customRules } from "@db/schema";
import { REPORT_DISCLAIMER } from "@contracts/constants";
import { consumeQuota, consumeQuotaMulti, refundQuota, refundQuotaMulti } from "./queries/billing";
import { createNotification } from "./queries/notifications";

const PLATFORM_VALUES = ["universal", "hongguo", "fanqie", "kuaishou", "wechat"] as const;
const WORK_TYPE_VALUES = ["ai_drama", "ai_comic", "live_drama"] as const;

const submissionInputSchema = z.object({
  workTitle: z.string().min(1, "请填写作品名称").max(255),
  workType: z.enum(WORK_TYPE_VALUES).default("ai_drama"),
  targetPlatform: z.enum(PLATFORM_VALUES).default("universal"),
  scriptText: z.string().min(50, "剧本内容过短（至少50字）").max(2_000_000, "剧本超出单次送检上限"),
  /** 整改复诊：关联的原送检 ID（可选，须为本人记录） */
  resubmitOf: z.number().int().positive().optional(),
});
type SubmissionInput = z.infer<typeof submissionInputSchema>;

/** 送检执行体：建单 → 检测 → 命中/报告落库 → 完成。失败抛错（额度由调用方退还） */
async function executeSubmission(userId: number, input: SubmissionInput) {
  const db = getDb();
  const ruleVersionRow = await getLatestRuleVersion();
  const ruleVersion = ruleVersionRow?.version ?? "unknown";
  let submissionId: number | null = null;
  try {
    const [inserted] = await db.insert(submissions).values({
      userId,
      workTitle: input.workTitle,
      workType: input.workType,
      targetPlatform: input.targetPlatform,
      scriptText: input.scriptText,
      charCount: input.scriptText.length,
      status: "processing",
      resubmitOfId: input.resubmitOf ?? null,
      ruleVersion,
    });
    submissionId = Number(inserted.insertId);
    const sid = submissionId;

    const [activeRules, userCustomRules] = await Promise.all([
      getActiveRules(),
      db
        .select()
        .from(customRules)
        .where(and(eq(customRules.userId, userId), eq(customRules.status, "active"))),
    ]);
    const result = await runDetection({
      scriptText: input.scriptText,
      workTitle: input.workTitle,
      targetPlatform: input.targetPlatform,
      activeRules,
      customRules: userCustomRules,
    });

    if (result.hits.length > 0) {
      await db.insert(detectionHits).values(
        result.hits.map((h) => ({
          submissionId: sid,
          episodeNo: h.episodeNo,
          location: h.location,
          spanText: h.spanText,
          category: h.category,
          ruleCode: h.ruleCode,
          ruleName: h.ruleName,
          severity: h.severity,
          confidence: String(h.confidence.toFixed(2)),
          basis: h.basis,
          sourceConfidence: h.sourceConfidence,
          remediation: h.remediation,
          matchSource: h.matchSource,
        })),
      );
    }

    const generatedAt = new Date();
    const hashPayload = JSON.stringify({
      submissionId: sid,
      workTitle: input.workTitle,
      scriptHash: createHash("sha256").update(input.scriptText).digest("hex"),
      hits: result.hits.map((h) => [h.ruleCode, h.episodeNo, h.location, h.spanText]),
      ruleVersion,
      generatedAt: generatedAt.toISOString(),
    });
    const contentHash = createHash("sha256").update(hashPayload).digest("hex");
    const reportNo = `JG-${generatedAt.toISOString().slice(0, 10).replaceAll("-", "")}-${String(sid).padStart(6, "0")}`;

    await db.insert(reports).values({
      submissionId: sid,
      reportNo,
      verdict: result.verdict,
      summary: result.summary,
      contentHash,
      ruleVersion,
      disclaimer: REPORT_DISCLAIMER,
      generatedAt,
    });

    await db
      .update(submissions)
      .set({ status: "completed", verdict: result.verdict, episodeCount: result.episodeCount, completedAt: generatedAt })
      .where(eq(submissions.id, sid));

    return { submissionId: sid, verdict: result.verdict, summary: result.summary };
  } catch (e) {
    if (submissionId !== null) {
      await db
        .update(submissions)
        .set({ status: "failed", errorMessage: e instanceof Error ? e.message : String(e) })
        .where(eq(submissions.id, submissionId))
        .catch(() => {});
    }
    throw e;
  }
}

export const submissionsRouter = createRouter({
  list: authedQuery.query(({ ctx }) => findSubmissionsByUser(ctx.user.id)),

  /** 创建送检并同步执行检测（MVP：单部 ≤80集，同步返回） */
  create: authedQuery
    .input(submissionInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.resubmitOf !== undefined) {
        const origin = await findSubmissionById(input.resubmitOf, ctx.user.id);
        if (!origin) throw new TRPCError({ code: "NOT_FOUND", message: "原送检记录不存在" });
      }
      await consumeQuota(ctx.user.id);
      try {
        const r = await executeSubmission(ctx.user.id, input);
        await createNotification(
          ctx.user.id, "detection_done", `检测完成：${input.workTitle}`,
          `结论 ${r.verdict}，命中 ${r.summary.totalHits} 处（阻断 ${r.summary.blockCount} / 高危 ${r.summary.highCount}）`,
          r.submissionId,
        );
        return r;
      } catch {
        await refundQuota(ctx.user.id).catch(() => {});
        await createNotification(ctx.user.id, "detection_failed", `检测失败：${input.workTitle}`, "系统执行异常，本次额度已退还，请重新提交");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "检测执行失败，已退还本次额度，请重试" });
      }
    }),

  /** 批量送检：一次最多 10 部，原子预扣 N 次额度，逐部执行，失败单部退额度不影响其他 */
  createBatch: authedQuery
    .input(z.object({ items: z.array(submissionInputSchema).min(1).max(10, "单次批量最多 10 部") }))
    .mutation(async ({ ctx, input }) => {
      const n = input.items.length;
      // 批量场景同样先校验复诊归属，再扣额度
      const refIds = [...new Set(input.items.map((i) => i.resubmitOf).filter((v): v is number => v !== undefined))];
      for (const rid of refIds) {
        const origin = await findSubmissionById(rid, ctx.user.id);
        if (!origin) throw new TRPCError({ code: "NOT_FOUND", message: `原送检记录 #${rid} 不存在` });
      }
      await consumeQuotaMulti(ctx.user.id, n);
      const results: { index: number; workTitle: string; ok: boolean; submissionId?: number; verdict?: string; error?: string }[] = [];
      let failed = 0;
      for (let i = 0; i < n; i++) {
        const item = input.items[i];
        try {
          const r = await executeSubmission(ctx.user.id, item);
          await createNotification(ctx.user.id, "detection_done", `检测完成：${item.workTitle}`, `结论 ${r.verdict}，命中 ${r.summary.totalHits} 处`, r.submissionId);
          results.push({ index: i, workTitle: item.workTitle, ok: true, submissionId: r.submissionId, verdict: r.verdict });
        } catch (e) {
          failed += 1;
          await createNotification(ctx.user.id, "detection_failed", `检测失败：${item.workTitle}`, "系统执行异常，该部额度已退还");
          results.push({ index: i, workTitle: item.workTitle, ok: false, error: "检测执行失败，额度已退还" });
        }
      }
      if (failed > 0) await refundQuotaMulti(ctx.user.id, failed).catch(() => {});
      return { total: n, succeeded: n - failed, failed, results };
    }),

  /** 送检详情：工单 + 命中 + 报告；viewPlatform 可按其他平台口径重看严重级（F9 分平台视图） */
  detail: authedQuery
    .input(z.object({ id: z.number(), viewPlatform: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const submission = await findSubmissionById(input.id, ctx.user.id);
      if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "送检记录不存在" });
      const [hits, report] = await Promise.all([
        findHitsBySubmission(submission.id),
        findReportBySubmission(submission.id),
      ]);

      // 分平台口径视图：按目标平台的 platformOverrides 重算严重级与整体结论
      let viewHits = hits;
      let viewVerdict = submission.verdict;
      const viewPlatform = input.viewPlatform;
      if (viewPlatform && viewPlatform !== submission.targetPlatform) {
        const allRules = await getDb().select().from(rulesTable);
        const ovMap = new Map(
          allRules.map((r) => [
            r.ruleCode,
            (r.platformOverrides as Record<string, { severity?: string }> | null)?.[
              viewPlatform
            ]?.severity,
          ]),
        );
        const rank = { block: 3, high: 2, notice: 1 } as const;
        viewHits = hits.map((h) => {
          const ov = ovMap.get(h.ruleCode);
          return ov && ov !== h.severity
            ? { ...h, severity: ov as typeof h.severity }
            : h;
        });
        let maxSev: keyof typeof rank | null = null;
        for (const h of viewHits) {
          if (!maxSev || rank[h.severity] > rank[maxSev]) maxSev = h.severity;
        }
        viewVerdict =
          maxSev === "block" ? "high_risk" : maxSev === "high" ? "attention" : "low_risk";
      }

      return { submission, hits: viewHits, report, viewPlatform: viewPlatform ?? null, viewVerdict };
    }),

  /** 复诊对比：原报告 vs 复诊报告的命中差异（已消除/仍在/新增） */
  recheckDiff: authedQuery
    .input(z.object({ baseId: z.number().int().positive(), compareId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const [base, compare] = await Promise.all([
        findSubmissionById(input.baseId, ctx.user.id),
        findSubmissionById(input.compareId, ctx.user.id),
      ]);
      if (!base || !compare) throw new TRPCError({ code: "NOT_FOUND", message: "送检记录不存在" });
      const [baseHits, compareHits] = await Promise.all([
        findHitsBySubmission(base.id),
        findHitsBySubmission(compare.id),
      ]);
      const key = (h: { ruleCode: string; episodeNo: number; location: string | null; spanText: string | null }) =>
        `${h.ruleCode}|${h.episodeNo}|${h.location ?? ""}|${h.spanText ?? ""}`;
      const compareKeys = new Set(compareHits.map(key));
      const baseKeys = new Set(baseHits.map(key));
      return {
        base: { id: base.id, workTitle: base.workTitle, verdict: base.verdict, createdAt: base.createdAt },
        compare: { id: compare.id, workTitle: compare.workTitle, verdict: compare.verdict, createdAt: compare.createdAt },
        resolved: baseHits.filter((h) => !compareKeys.has(key(h))),
        persisting: baseHits.filter((h) => compareKeys.has(key(h))),
        added: compareHits.filter((h) => !baseKeys.has(key(h))),
      };
    }),

  /** 同作品送检记录（复诊对比的候选列表） */
  relatedSubmissions: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const me = await findSubmissionById(input.id, ctx.user.id);
      if (!me) throw new TRPCError({ code: "NOT_FOUND", message: "送检记录不存在" });
      const all = await findSubmissionsByUser(ctx.user.id);
      return all
        .filter((r) => r.workTitle === me.workTitle && r.id !== me.id && r.status === "completed")
        .map((r) => ({ id: r.id, verdict: r.verdict, createdAt: r.createdAt, resubmitOfId: r.resubmitOfId }));
    }),

  /** 导出 Word 报告：服务端生成 .docx，base64 返回（含存证信息与免责声明） */
  exportWord: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const submission = await findSubmissionById(input.id, ctx.user.id);
      if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "送检记录不存在" });
      const [hits, report] = await Promise.all([
        findHitsBySubmission(submission.id),
        findReportBySubmission(submission.id),
      ]);
      if (!report) throw new TRPCError({ code: "BAD_REQUEST", message: "报告尚未生成，无法导出" });

      const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType } = await import("docx");
      const sevText: Record<string, string> = { block: "阻断", high: "高危", notice: "提示" };
      const verdictText: Record<string, string> = { high_risk: "高风险（建议暂缓上线）", attention: "需关注（建议整改后上线）", low_risk: "低风险（可上线）" };
      const summary = report.summary as { totalHits?: number; blockCount?: number; highCount?: number; noticeCount?: number; episodeCount?: number } | null;

      const cell = (t: string, bold = false) =>
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold, size: 18 })] })] });
      const hitRows = hits.map((h) =>
        new TableRow({
          children: [
            cell(`第${h.episodeNo}集`),
            cell(h.location ?? ""),
            cell(sevText[h.severity] ?? h.severity),
            cell(h.ruleName ?? h.ruleCode),
            cell((h.spanText ?? "").slice(0, 80)),
            cell((h.remediation ?? "").slice(0, 200)),
          ],
        }),
      );

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({ heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "短剧合规预检报告", bold: true })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "剧合规 · AI短剧/漫剧上线前合规预检", size: 20, color: "666666" })] }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun({ text: `作品名称：${submission.workTitle}`, size: 22 })] }),
            new Paragraph({ children: [new TextRun({ text: `报告编号：${report.reportNo}`, size: 22 })] }),
            new Paragraph({ children: [new TextRun({ text: `检测时间：${report.generatedAt?.toISOString?.() ?? ""}`, size: 22 })] }),
            new Paragraph({ children: [new TextRun({ text: `整体结论：${verdictText[report.verdict] ?? report.verdict}`, size: 22, bold: true })] }),
            new Paragraph({ children: [new TextRun({ text: `集数：${submission.episodeCount ?? "-"}　命中：${summary?.totalHits ?? hits.length} 处（阻断 ${summary?.blockCount ?? 0} / 高危 ${summary?.highCount ?? 0} / 提示 ${summary?.noticeCount ?? 0}）`, size: 22 })] }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun({ text: "命中明细", bold: true, size: 26 })] }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({ children: ["集", "位置", "级别", "规则", "片段", "整改建议"].map((t) => cell(t, true)) }),
                ...hitRows,
              ],
            }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun({ text: "存证信息", bold: true, size: 24 })] }),
            new Paragraph({ children: [new TextRun({ text: `内容哈希（SHA-256）：${report.contentHash}`, size: 18, color: "666666" })] }),
            new Paragraph({ children: [new TextRun({ text: `规则版本：${report.ruleVersion}`, size: 18, color: "666666" })] }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun({ text: `免责声明：${report.disclaimer}`, size: 18, color: "999999" })] }),
          ],
        }],
      });
      const buf = await Packer.toBuffer(doc);
      const safeTitle = submission.workTitle.replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
      return { filename: `合规预检报告-${safeTitle}-${report.reportNo}.docx`, base64: buf.toString("base64") };
    }),

  /** 整改留痕：标记命中采纳/不采纳 */
  reviewHit: authedQuery
    .input(
      z.object({
        hitId: z.number(),
        status: z.enum(["accepted", "dismissed"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const rows = await db
        .select({ submissionId: detectionHits.submissionId })
        .from(detectionHits)
        .where(eq(detectionHits.id, input.hitId))
        .limit(1);
      const hit = rows[0];
      if (!hit) throw new TRPCError({ code: "NOT_FOUND" });
      const sub = await findSubmissionById(hit.submissionId, ctx.user.id);
      // 与 detail 等接口同口径：非本人资源按不存在处理，避免枚举探测
      if (!sub) throw new TRPCError({ code: "NOT_FOUND", message: "命中记录不存在" });
      await db
        .update(detectionHits)
        .set({ reviewStatus: input.status })
        .where(and(eq(detectionHits.id, input.hitId)));
      return { ok: true };
    }),
});
