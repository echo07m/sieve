/**
 * 站点信息集中配置：品牌与联系口径的唯一事实来源。
 * 发布前只需修改本文件（ICP 备案号、域名、商务邮箱等在取得后替换）。
 */

export const SITE = {
  brand: "剧合规",
  slogan: "AI短剧/漫剧上线前合规预检",
  fullTitle: "剧合规 - AI短剧/漫剧上线前合规预检 | 广电总局新规适配",
  description:
    "AI短剧合规预检工具：8大违规类别检测、集-句级定位、AI魔改识别、备案材料包、平台差分适配，附置信度与依据条文的存证报告。",
  /** 商务联系方式（留资线索的对外展示口径） */
  contactEmail: "macronet07@163.com",
  /** 运营主体（用户协议/隐私政策中的责任主体） */
  companyName: "剧合规运营团队", // TODO(商用前): 替换为营业执照主体全称
  /** ICP 备案号占位：取得备案后替换，未备案期间页脚不展示 */
  icpNo: "", // 例如 "京ICP备2026XXXXXX号-1"
  /** 站点正式域名（sitemap/robots/canonical 用），发布后替换 */
  siteUrl: "http://macrobit.com.cn",
} as const;
