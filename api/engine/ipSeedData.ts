/**
 * F4 AI魔改识别（基础版）种子数据
 * C4 版权参照库：首批经典 IP 形象（名称+别名+出处），以及
 * 「IP形象 × 偏离情节」共现规则——复用规则引擎共现通道，
 * 命中即输出改编红线预警与比对证据（开发文档 F4 基础版：剧本侧识别）。
 */
import type { InsertRule } from "@db/schema";

export interface IpSeed {
  name: string;
  aliases: string[];
  origin: string;
  category: string;
}

export const ipSeeds: IpSeed[] = [
  // 西游记
  { name: "孙悟空", aliases: ["齐天大圣", "孙行者", "美猴王"], origin: "《西游记》", category: "名著" },
  { name: "猪八戒", aliases: ["猪悟能", "天蓬元帅"], origin: "《西游记》", category: "名著" },
  { name: "唐僧", aliases: ["唐三藏", "玄奘"], origin: "《西游记》", category: "名著" },
  { name: "沙僧", aliases: ["沙悟净"], origin: "《西游记》", category: "名著" },
  { name: "白骨精", aliases: ["白骨夫人"], origin: "《西游记》", category: "名著" },
  { name: "牛魔王", aliases: [], origin: "《西游记》", category: "名著" },
  { name: "红孩儿", aliases: ["圣婴大王"], origin: "《西游记》", category: "名著" },
  { name: "观音菩萨", aliases: ["观世音"], origin: "《西游记》", category: "名著" },
  // 红楼梦
  { name: "林黛玉", aliases: ["黛玉", "林妹妹"], origin: "《红楼梦》", category: "名著" },
  { name: "贾宝玉", aliases: ["宝玉"], origin: "《红楼梦》", category: "名著" },
  { name: "薛宝钗", aliases: ["宝钗"], origin: "《红楼梦》", category: "名著" },
  { name: "王熙凤", aliases: ["凤姐"], origin: "《红楼梦》", category: "名著" },
  // 三国演义
  { name: "诸葛亮", aliases: ["孔明", "卧龙"], origin: "《三国演义》", category: "名著" },
  { name: "关羽", aliases: ["关云长", "关公"], origin: "《三国演义》", category: "名著" },
  { name: "曹操", aliases: ["曹孟德"], origin: "《三国演义》", category: "名著" },
  { name: "刘备", aliases: ["刘玄德"], origin: "《三国演义》", category: "名著" },
  { name: "张飞", aliases: ["张翼德"], origin: "《三国演义》", category: "名著" },
  { name: "赵云", aliases: ["赵子龙"], origin: "《三国演义》", category: "名著" },
  { name: "吕布", aliases: ["吕奉先"], origin: "《三国演义》", category: "名著" },
  { name: "貂蝉", aliases: [], origin: "《三国演义》", category: "名著" },
  // 水浒传
  { name: "武松", aliases: ["武二郎"], origin: "《水浒传》", category: "名著" },
  { name: "林冲", aliases: ["豹子头"], origin: "《水浒传》", category: "名著" },
  { name: "宋江", aliases: ["及时雨"], origin: "《水浒传》", category: "名著" },
  { name: "潘金莲", aliases: [], origin: "《水浒传》", category: "名著" },
  { name: "鲁智深", aliases: ["花和尚"], origin: "《水浒传》", category: "名著" },
  // 神话传说
  { name: "白娘子", aliases: ["白素贞", "白蛇"], origin: "《白蛇传》", category: "神话" },
  { name: "许仙", aliases: [], origin: "《白蛇传》", category: "神话" },
  { name: "法海", aliases: [], origin: "《白蛇传》", category: "神话" },
  { name: "哪吒", aliases: ["哪吒三太子"], origin: "《封神演义》", category: "神话" },
  { name: "姜子牙", aliases: ["姜太公"], origin: "《封神演义》", category: "神话" },
  { name: "妲己", aliases: ["苏妲己"], origin: "《封神演义》", category: "神话" },
  { name: "嫦娥", aliases: ["嫦娥仙子"], origin: "中国神话", category: "神话" },
  { name: "后羿", aliases: [], origin: "中国神话", category: "神话" },
  { name: "牛郎织女", aliases: ["织女"], origin: "中国神话", category: "神话" },
  { name: "孟姜女", aliases: [], origin: "中国民间传说", category: "神话" },
  { name: "花木兰", aliases: [], origin: "《木兰辞》", category: "神话" },
  { name: "济公", aliases: ["济颠"], origin: "中国民间传说", category: "神话" },
  { name: "钟馗", aliases: [], origin: "中国民间传说", category: "神话" },
  { name: "包青天", aliases: ["包拯", "包公"], origin: "历史/戏曲形象", category: "名著" },
  // 经典动画
  { name: "葫芦娃", aliases: ["葫芦兄弟"], origin: "《葫芦兄弟》", category: "动画" },
  { name: "黑猫警长", aliases: [], origin: "《黑猫警长》", category: "动画" },
  { name: "舒克贝塔", aliases: ["舒克", "贝塔"], origin: "《舒克和贝塔》", category: "动画" },
  { name: "大头儿子", aliases: ["小头爸爸"], origin: "《大头儿子和小头爸爸》", category: "动画" },
  { name: "喜羊羊", aliases: ["灰太狼"], origin: "《喜羊羊与灰太狼》", category: "动画" },
  { name: "熊大", aliases: ["熊二", "光头强"], origin: "《熊出没》", category: "动画" },
  { name: "奥特曼", aliases: ["迪迦奥特曼", "赛罗奥特曼"], origin: "《奥特曼》系列", category: "动画" },
  { name: "哆啦A梦", aliases: ["机器猫", "小叮当"], origin: "《哆啦A梦》", category: "动画" },
  { name: "名侦探柯南", aliases: ["柯南", "工藤新一"], origin: "《名侦探柯南》", category: "动画" },
  { name: "海贼王", aliases: ["路飞"], origin: "《海贼王》", category: "动画" },
  { name: "火影忍者", aliases: ["鸣人"], origin: "《火影忍者》", category: "动画" },
  { name: "美少女战士", aliases: ["月野兔"], origin: "《美少女战士》", category: "动画" },
  { name: "灌篮高手", aliases: ["樱木花道"], origin: "《灌篮高手》", category: "动画" },
  // 经典影视
  { name: "黄飞鸿", aliases: [], origin: "《黄飞鸿》系列", category: "影视" },
  { name: "霍元甲", aliases: [], origin: "《霍元甲》", category: "影视" },
  { name: "陈真", aliases: [], origin: "《精武门》", category: "影视" },
  { name: "叶问", aliases: [], origin: "《叶问》系列", category: "影视" },
  { name: "东方不败", aliases: [], origin: "《笑傲江湖》", category: "影视" },
  { name: "令狐冲", aliases: [], origin: "《笑傲江湖》", category: "影视" },
  { name: "郭靖", aliases: ["靖哥哥"], origin: "《射雕英雄传》", category: "影视" },
  { name: "黄蓉", aliases: [], origin: "《射雕英雄传》", category: "影视" },
  { name: "杨过", aliases: ["神雕大侠"], origin: "《神雕侠侣》", category: "影视" },
  { name: "小龙女", aliases: [], origin: "《神雕侠侣》", category: "影视" },
  { name: "乔峰", aliases: ["萧峰"], origin: "《天龙八部》", category: "影视" },
  { name: "韦小宝", aliases: [], origin: "《鹿鼎记》", category: "影视" },
  { name: "张无忌", aliases: [], origin: "《倚天屠龙记》", category: "影视" },
  { name: "白浅", aliases: ["素素"], origin: "《三生三世十里桃花》", category: "影视" },
  { name: "甄嬛", aliases: ["熹贵妃"], origin: "《甄嬛传》", category: "影视" },
  { name: "梅长苏", aliases: ["苏哥哥"], origin: "《琅琊榜》", category: "影视" },
  { name: "花千骨", aliases: ["小骨"], origin: "《花千骨》", category: "影视" },
  // 游戏
  { name: "仙剑奇侠传", aliases: ["李逍遥", "赵灵儿"], origin: "《仙剑奇侠传》", category: "游戏" },
  { name: "王者荣耀", aliases: ["李白", "妲己宝宝"], origin: "《王者荣耀》", category: "游戏" },
];

/** 偏离情节词组：经典IP与这些情节共现即构成「魔改」红线风险 */
export const DEVIATION_GROUPS = {
  crime: ["杀人", "黑帮", "吸毒", "贩毒", "抢劫", "绑票", "恶棍", "杀手"],
  erotic: ["卖淫", "情色", "一夜情", "出轨", "潜规则", "陪睡"],
  parody: ["穿越到现代", "直播带货", "打游戏", "送外卖", "开公司", "炒股票", "当网红"],
  romance: ["恋爱", "表白", "结婚", "组CP", "结婚生子", "三角恋"],
};

/** 生成 AI 魔改共现规则（每个偏离类别一条，便于报告归因） */
export function buildMagicAdaptRules(): InsertRule[] {
  const allNames = ipSeeds.flatMap((ip) => [ip.name, ...ip.aliases]);
  const mk = (
    code: string,
    name: string,
    groupB: string[],
    severity: "block" | "high",
    remediation: string,
  ): InsertRule => ({
    ruleCode: code,
    version: "1.0.0",
    category: "ip_infringement",
    name,
    severity,
    sourcePolicy: "管理提示（AI魔改）（2024年12月）",
    sourceClause: "AI魔改经典作品管理提示",
    originalText: "毫无边界亵渎经典IP、篡改经典人物形象属重点治理对象",
    sourceConfidence: "official_text",
    scope: ["full_text"],
    keywords: [],
    patterns: [],
    cooccurrence: [{ groupA: allNames, groupB, window: 100 }],
    baseConfidence: "0.82",
    remediationTemplate: remediation,
    platformOverrides: {},
  });

  return [
    mk(
      "R8-2026-003",
      "经典IP×违法犯罪情节",
      DEVIATION_GROUPS.crime,
      "block",
      "命中AI魔改红线：经典IP形象与违法犯罪情节共现（依据：2024年12月《管理提示（AI魔改）》）。将经典角色置于犯罪情节构成对经典人物形象的篡改与亵渎，建议立即删除该设定或改用原创角色；如已获IP授权，请在授权链留痕中补充改编红线确认记录。",
    ),
    mk(
      "R8-2026-004",
      "经典IP×色情情节",
      DEVIATION_GROUPS.erotic,
      "block",
      "命中AI魔改红线：经典IP形象与色情情节共现（依据：2024年12月《管理提示（AI魔改）》）。该类改编属重点治理对象，平台侧肖像库比对亦可命中，建议彻底改写。",
    ),
    mk(
      "R8-2026-005",
      "经典IP×恶搞穿越情节",
      DEVIATION_GROUPS.parody,
      "high",
      "命中AI魔改高危：经典IP形象被置于恶搞/穿越情节，偏离原设定。若改编边界未经IP方确认，建议改用原创角色或取得授权并完成改编红线留痕。",
    ),
    mk(
      "R8-2026-006",
      "经典IP×言情化改编",
      DEVIATION_GROUPS.romance,
      "high",
      "命中AI魔改高危：经典IP形象被言情化改编（恋爱/婚配向）。此类改编易触碰'亵渎经典'口径，建议评估改编幅度并完成授权链留痕。",
    ),
  ];
}

export const IP_SEED_VERSION = "2026.09-v2";
