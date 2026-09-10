import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { storyboards, submissions } from "@db/schema";
import { authedQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";
import {
  breakDownScript,
  storyboardToCsv,
  storyboardToPromptPack,
  type Storyboard,
} from "./engine/storyboard";

const createInput = z
  .object({
    workTitle: z.string().min(1, "请填写作品名称").max(128),
    scriptText: z.string().max(2_000_000).optional(),
    submissionId: z.number().int().positive().optional(),
  })
  .refine((v) => (v.scriptText && v.scriptText.trim().length >= 10) || v.submissionId, {
    message: "请粘贴剧本全文（至少 10 字）或选择送检记录",
  });

/** 分镜拆解：剧本 → 结构化分镜表 + 逐镜 agentPrompt，衔接视频生成 agent */
export const storyboardRouter = createRouter({
  /** 生成分镜（从文本或已有送检记录），结果落库 */
  create: authedQuery.input(createInput).mutation(async ({ ctx, input }) => {
    const db = getDb();
    let text = input.scriptText?.trim() ?? "";
    if (!text && input.submissionId) {
      const [sub] = await db
        .select()
        .from(submissions)
        .where(eq(submissions.id, input.submissionId));
      if (!sub || sub.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "送检记录不存在" });
      }
      text = sub.scriptText;
    }
    const sb = breakDownScript(input.workTitle, text);
    if (sb.shotCount === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "未能从剧本中拆解出有效镜头，请检查文本格式" });
    }
    const r = await db.insert(storyboards).values({
      userId: ctx.user.id,
      submissionId: input.submissionId ?? null,
      workTitle: sb.workTitle,
      episodeCount: sb.episodeCount,
      shotCount: sb.shotCount,
      totalDurationSec: sb.totalDurationSec,
      shots: sb.shots,
      engineVersion: sb.engineVersion,
    });
    return { ok: true, id: Number(r[0].insertId), shotCount: sb.shotCount, totalDurationSec: sb.totalDurationSec };
  }),

  /** 历史列表 */
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select({
        id: storyboards.id,
        workTitle: storyboards.workTitle,
        episodeCount: storyboards.episodeCount,
        shotCount: storyboards.shotCount,
        totalDurationSec: storyboards.totalDurationSec,
        engineVersion: storyboards.engineVersion,
        createdAt: storyboards.createdAt,
      })
      .from(storyboards)
      .where(eq(storyboards.userId, ctx.user.id))
      .orderBy(desc(storyboards.createdAt))
      .limit(100);
  }),

  /** 详情（含完整分镜表） */
  detail: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db.select().from(storyboards).where(eq(storyboards.id, input.id));
      if (!row || row.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "分镜记录不存在" });
      }
      return row;
    }),

  /** 导出：json / csv / prompt pack txt（base64 返回，前端下载） */
  exportFile: authedQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        format: z.enum(["json", "csv", "promptpack"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db.select().from(storyboards).where(eq(storyboards.id, input.id));
      if (!row || row.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "分镜记录不存在" });
      }
      const sb: Storyboard = {
        workTitle: row.workTitle,
        episodeCount: row.episodeCount,
        shotCount: row.shotCount,
        totalDurationSec: row.totalDurationSec,
        shots: row.shots as Storyboard["shots"],
        engineVersion: row.engineVersion,
      };
      let content: string;
      let filename: string;
      let mime: string;
      if (input.format === "json") {
        content = JSON.stringify(sb, null, 2);
        filename = `${row.workTitle}-分镜.json`;
        mime = "application/json";
      } else if (input.format === "csv") {
        content = storyboardToCsv(sb);
        filename = `${row.workTitle}-分镜表.csv`;
        mime = "text/csv";
      } else {
        content = storyboardToPromptPack(sb);
        filename = `${row.workTitle}-提示词包.txt`;
        mime = "text/plain";
      }
      return {
        filename,
        mime,
        base64: Buffer.from(content, "utf8").toString("base64"),
      };
    }),

  /** 删除 */
  remove: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [row] = await db.select().from(storyboards).where(eq(storyboards.id, input.id));
      if (!row || row.userId !== ctx.user.id) {
        throw new TRPCError({ code: "NOT_FOUND", message: "分镜记录不存在" });
      }
      await db.delete(storyboards).where(eq(storyboards.id, input.id));
      return { ok: true };
    }),
});
