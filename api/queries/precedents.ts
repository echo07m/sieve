import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { precedentCases, type PrecedentCase } from "@db/schema";
import { getDb } from "./connection";

export type { PrecedentCase };

/**
 * 判例种子：2026 年公开报道/公告中的真实处置与判例。
 * 信息均来自公开渠道（见 source/sourceUrl），仅作合规参考佐证。
 * 首次查询判例库为空时懒播种（与规则库同一模式）。
 */
const PRECEDENT_SEED: Omit<PrecedentCase, "id" | "createdAt">[] = [
  {
    title: "《桃花簪》AI“偷脸”侵权事件",
    platform: "红果短剧",
    caseType: "rights_protection",
    summary:
      "汉服博主公开指控古风 AI 微短剧《桃花簪》未经授权抓取其个人写真照片，利用 AI 技术生成剧中反派角色形象。出品方在 72 小时审核期内未能出具素材合规使用的有效证据。",
    violation: "未经授权使用真人肖像（AI 换脸/抓图生成角色）",
    outcome: "平台全面下架该剧，并暂停出品方上传所有剧集 15 天",
    source: "中国网络视听节目服务协会《视听动态》",
    sourceUrl: "http://www.cnsa.cn/art/2026/8/13/art_1955_49173.html",
    relatedRuleCodes: ["R8-2026-001", "R8-2026-003", "R8-2026-004"],
    occurredAt: new Date("2026-04-10"),
    isActive: true,
  },
  {
    title: "《鲛珠引》盗用摄影作品与模特形象案",
    platform: "全网",
    caseType: "rights_protection",
    summary:
      "播放量超 2300 万的 AI 微短剧《鲛珠引》被指控盗用摄影师原创作品与模特形象、妆造。双方最终达成赔偿和解，作品下架。",
    violation: "盗用他人享有著作权的摄影/美术素材及模特形象",
    outcome: "作品下架，双方达成赔偿和解",
    source: "中国网络视听节目服务协会《视听动态》",
    sourceUrl: "http://www.cnsa.cn/art/2026/8/13/art_1955_49173.html",
    relatedRuleCodes: ["R8-2026-001", "R8-2026-002"],
    occurredAt: new Date("2026-03-15"),
    isActive: true,
  },
  {
    title: "红果一周拦截下架 3522 部低质 AI 漫剧",
    platform: "红果短剧",
    caseType: "platform_action",
    summary:
      "2026 年 4 月 7 日启动专项整治，仅一周时间平台下架 3522 部未完成备案、未标注 AI 属性的 AI 漫剧作品；一季度累计核查 1.5 万部短剧，处置违规作品 670 部，违规类型集中在 AI 盗脸侵权、盗用 IP 形象、无授权 AI 合成内容等。",
    violation: "未备案、未标注 AI 属性、AI 盗脸侵权、盗用 IP 形象",
    outcome: "下架 3522 部；一季度累计处置 670 部",
    source: "澎湃新闻《7月起执行！所有AI微短剧必须标注》",
    sourceUrl: "https://m.thepaper.cn/newsDetail_forward_33643733",
    relatedRuleCodes: ["R8-2026-001", "R8-2026-003", "R9-2026-001"],
    occurredAt: new Date("2026-04-07"),
    isActive: true,
  },
  {
    title: "红果《关于规范AI剧角色创作的公告》高频AI脸治理",
    platform: "红果短剧",
    caseType: "platform_action",
    summary:
      "公告明确 AI 剧角色创作应避免雷同、杜绝“千篇一律”：单部剧集内男女主及核心配角必须拥有独立五官，仅更换发型服饰而底层人脸模板一致的情况判定违规；对判定为“高频复用”的剧集采取“零流量”等流量调控措施。",
    violation: "角色形象高度雷同（高频AI脸）、素材违规复用",
    outcome: "启动专项治理，问题剧集需修改/替换，高频复用剧集零流量",
    source: "红果短剧公告（北京日报/长安街知事报道）",
    sourceUrl: "https://xinwen.bjd.com.cn/content/s6a82aa03e4b03fa51a830460.html",
    relatedRuleCodes: ["R8-2026-003", "R8-2026-005"],
    occurredAt: new Date("2026-08-17"),
    isActive: true,
  },
  {
    title: "北京互联网法院 AI 换脸侵害肖像权案",
    platform: "司法",
    caseType: "judicial",
    summary:
      "某制作公司借助深度合成技术，将知名演员肖像嫁接至短剧角色面部，误导观众以为艺人参与演出。法院判定制作方侵害肖像权。",
    violation: "深度合成盗用名人肖像（AI 换脸），误导公众",
    outcome: "法院判令公开致歉并赔偿经济损失",
    source: "澎湃新闻引述北京互联网法院审理案件",
    sourceUrl: "https://m.thepaper.cn/newsDetail_forward_33643733",
    relatedRuleCodes: ["R8-2026-001", "R8-2026-004"],
    occurredAt: new Date("2026-05-01"),
    isActive: true,
  },
  {
    title: "抖音短剧版权中心 15 家合作方永久禁入",
    platform: "抖音",
    caseType: "platform_action",
    summary:
      "抖音集团短剧版权中心将 15 家上传盗版内容的合作方纳入永久禁止合作名单，下架相关微短剧、漫剧累计 6087 部。快手小剧场同期完成 8000 余部 AI 漫剧排查，下架违规作品 900 余部，并建立 AI 素材授权核验机制。",
    violation: "上传盗版/无授权内容",
    outcome: "15 家合作方永久禁入，下架 6087 部；快手下架 900 余部",
    source: "中国网络视听节目服务协会《视听动态》",
    sourceUrl: "http://www.cnsa.cn/art/2026/8/13/art_1955_49173.html",
    relatedRuleCodes: ["R8-2026-001", "R8-2026-002"],
    occurredAt: new Date("2026-06-20"),
    isActive: true,
  },
  {
    title: "微信集中下架近百部违规微短剧",
    platform: "微信",
    caseType: "platform_action",
    summary:
      "微信平台 2026 年 7 月发布公告，集中下架近百部违规微短剧并处置相关违规小程序，涉及价值观导向不正、内容粗制滥造等问题，同时进一步规范真人类、动画类和 AI 真人类微短剧的管理标准。",
    violation: "价值观导向不正、内容粗制滥造",
    outcome: "下架近百部，处置相关违规小程序",
    source: "微信平台公告（运营研究社报道）",
    sourceUrl: "https://www.yunyingbu.com/yanjiusuo/yunying/1392.html",
    relatedRuleCodes: ["R4-2026-001", "R5-2026-001", "R6-2026-001"],
    occurredAt: new Date("2026-07-20"),
    isActive: true,
  },
  {
    title: "爆款剧因无备案号被下架（跑量分账后强制下线）",
    platform: "全网",
    caseType: "platform_action",
    summary:
      "一部已跑出分账的爆款短剧因未取得备案号被下架。2026 年新规要求所有上线播出的微短剧均须持有《网络剧片发行许可证》或完成上线报备登记程序，并在片头标注备案号，未备案不得上线、不得投流。",
    violation: "无备案号上线播出",
    outcome: "全剧下架，分账中断",
    source: "博客园行业复盘《一部跑了分账的爆款剧，因为没有备案号被下架》",
    sourceUrl: "https://www.cnblogs.com/Webcom/articles/20423864",
    relatedRuleCodes: ["R9-2026-001"],
    occurredAt: new Date("2026-06-01"),
    isActive: true,
  },
];

/** 懒播种：判例库为空时写入种子（幂等） */
export async function seedPrecedentsIfEmpty(): Promise<void> {
  const db = getDb();
  const [{ c }] = await db
    .select({ c: sql<number>`count(*)` })
    .from(precedentCases);
  if (c > 0) return;
  for (const row of PRECEDENT_SEED) {
    await db.insert(precedentCases).values(row);
  }
}

export type PrecedentListParams = {
  keyword?: string;
  platform?: string;
  caseType?: PrecedentCase["caseType"];
  page: number;
  pageSize: number;
};

/** 公开检索：仅返回生效判例 */
export async function listPrecedents(params: PrecedentListParams) {
  await seedPrecedentsIfEmpty();
  const db = getDb();
  const conds = [eq(precedentCases.isActive, true)];
  if (params.keyword) {
    const kw = `%${params.keyword}%`;
    conds.push(
      or(
        like(precedentCases.title, kw),
        like(precedentCases.summary, kw),
        like(precedentCases.violation, kw),
      )!,
    );
  }
  if (params.platform) conds.push(eq(precedentCases.platform, params.platform));
  if (params.caseType) conds.push(eq(precedentCases.caseType, params.caseType));

  const where = and(...conds);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(precedentCases)
    .where(where);
  const items = await db
    .select()
    .from(precedentCases)
    .where(where)
    .orderBy(desc(precedentCases.occurredAt))
    .limit(params.pageSize)
    .offset((params.page - 1) * params.pageSize);
  return { items, total };
}

/** 按关联规则 code 取判例（报告页判例佐证用） */
export async function getPrecedentsByRuleCodes(
  codes: string[],
  limit = 6,
): Promise<PrecedentCase[]> {
  if (codes.length === 0) return [];
  await seedPrecedentsIfEmpty();
  const db = getDb();
  const all = await db
    .select()
    .from(precedentCases)
    .where(eq(precedentCases.isActive, true))
    .orderBy(desc(precedentCases.occurredAt));
  const set = new Set(codes);
  return all
    .filter((c) => c.relatedRuleCodes.some((code) => set.has(code)))
    .slice(0, limit);
}

/** 平台去重列表（筛选用） */
export async function listPrecedentPlatforms(): Promise<string[]> {
  await seedPrecedentsIfEmpty();
  const db = getDb();
  const rows = await db
    .selectDistinct({ platform: precedentCases.platform })
    .from(precedentCases)
    .where(eq(precedentCases.isActive, true));
  return rows.map((r) => r.platform).filter(Boolean);
}

// ============ 管理后台 CRUD ============

export async function adminListPrecedents() {
  const db = getDb();
  return db
    .select()
    .from(precedentCases)
    .orderBy(desc(precedentCases.createdAt));
}

export async function createPrecedent(
  row: Omit<PrecedentCase, "id" | "createdAt">,
) {
  const db = getDb();
  await db.insert(precedentCases).values(row);
}

export async function updatePrecedent(
  id: number,
  patch: Partial<Omit<PrecedentCase, "id" | "createdAt">>,
) {
  const db = getDb();
  await db.update(precedentCases).set(patch).where(eq(precedentCases.id, id));
}

export async function deletePrecedent(id: number) {
  const db = getDb();
  await db.delete(precedentCases).where(eq(precedentCases.id, id));
}
