import { z } from "zod";
import { adminQuery, createRouter, publicQuery } from "./middleware";
import {
  adminListPrecedents,
  createPrecedent,
  deletePrecedent,
  getPrecedentsByRuleCodes,
  listPrecedents,
  listPrecedentPlatforms,
  updatePrecedent,
} from "./queries/precedents";

const caseTypeEnum = z.enum([
  "platform_action",
  "judicial",
  "regulatory",
  "rights_protection",
]);

const precedentInput = z.object({
  title: z.string().min(2).max(128),
  platform: z.string().max(32).default(""),
  caseType: caseTypeEnum,
  summary: z.string().min(10).max(1000),
  violation: z.string().max(200).default(""),
  outcome: z.string().max(300).default(""),
  source: z.string().max(128).default(""),
  sourceUrl: z.string().max(300).default(""),
  relatedRuleCodes: z.array(z.string().max(32)).max(10),
  occurredAt: z.coerce.date().nullable().optional(),
  isActive: z.boolean().default(true),
});

/**
 * 判例库：公开检索（登录态/游客均可）+ 管理后台维护。
 * 判例仅收录公开报道/公告中的真实事件，作为检测报告的佐证参考。
 */
export const precedentRouter = createRouter({
  /** 公开：分页检索判例 */
  list: publicQuery
    .input(
      z.object({
        keyword: z.string().max(64).optional(),
        platform: z.string().max(32).optional(),
        caseType: caseTypeEnum.optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(50).default(9),
      }),
    )
    .query(({ input }) => listPrecedents(input)),

  /** 公开：平台去重列表（筛选下拉用） */
  platforms: publicQuery.query(() => listPrecedentPlatforms()),

  /** 公开：按规则 code 取相关判例（报告页佐证） */
  byRuleCodes: publicQuery
    .input(z.object({ codes: z.array(z.string().max(32)).min(1).max(20) }))
    .query(({ input }) => getPrecedentsByRuleCodes(input.codes)),

  /** 后台：全量列表（含下架判例） */
  adminList: adminQuery.query(() => adminListPrecedents()),

  /** 后台：新增判例 */
  create: adminQuery.input(precedentInput).mutation(async ({ input }) => {
    await createPrecedent({
      ...input,
      occurredAt: input.occurredAt ?? null,
    });
    return { ok: true };
  }),

  /** 后台：编辑判例 */
  update: adminQuery
    .input(z.object({ id: z.number().int().positive(), data: precedentInput }))
    .mutation(async ({ input }) => {
      await updatePrecedent(input.id, {
        ...input.data,
        occurredAt: input.data.occurredAt ?? null,
      });
      return { ok: true };
    }),

  /** 后台：删除判例 */
  remove: adminQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await deletePrecedent(input.id);
      return { ok: true };
    }),
});
