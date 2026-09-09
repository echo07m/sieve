# 剧合规（JuHeGui）

> AI 短剧 / 漫剧上线前合规预检工具链 —— 面向制作方、MCN 与平台方的一站式合规预检 SaaS。
> Pre-launch compliance pre-check toolchain for AI short dramas & comic-dramas.

![License](https://img.shields.io/badge/license-Apache--2.0%20%2B%20Additional%20Terms-blue)
![Build](https://img.shields.io/badge/build-passing-brightgreen)
![React](https://img.shields.io/badge/React-19-61dafb)
![tRPC](https://img.shields.io/badge/tRPC-11-blue)

[English](#english) | [快速开始](#快速开始) | [开源协议](#开源协议-license) | [赞助商](#赞助商-sponsors) | [联系方式](#联系方式-contact) | [贡献指南](CONTRIBUTING.md)

<!-- ===== 广告位 AD SLOT: README 顶部冠名位（728x90 或 Logo+一句话） 虚位以待，洽谈见文末联系方式 ===== -->

「剧合规」在短剧/漫剧**上线之前**，对剧本进行自动化合规预检：按 8 大违规类别做**集-句级定位**，输出附带**政策依据条文与整改建议**的检测报告，并对报告做 **SHA-256 + 规则版本存证**；同时覆盖整改复诊对比、分平台口径、备案导航与材料包、AI 标识校验（GB 45438）、版权自查、片名快检与开放 API。

## 核心功能

- **剧本合规预检**：8 大违规类别（涉儿童有害/软色情擦边/拜金炫富/畸形婚恋观/封建糟粕/暴力复仇/低俗片名/IP 魔改侵权），19 项规则、三通道匹配（关键词/正则/共现）。
- **集-句级定位**：命中精确到第几集哪一句，附置信度与依据条文。
- **整改复诊闭环**：改后复诊，自动生成「已消除/仍存在/新增」三组对比。
- **报告与存证**：Word(.docx) 导出、SHA-256 内容哈希 + 规则版本固化，可回溯复核。
- **批量送检**：一次最多 10 部，原子扣减额度，单部失败自动退还。
- **分平台口径**：红果/番茄/快手/微信小程序剧差分规则，支持按平台视角复看同一份报告。
- **备案导航与材料包**：投资额分层判定（2026-01-01 新标准）+ AI 占比自评 + 材料清单 + 一键生成三件套。
- **AI 标识校验**：GB 45438-2025 显式/隐式标识量化校验与自检清单。
- **版权自查**：内置经典 IP 参照库，识别魔改/侵权风险。
- **规则运营**：规则启停热更新、版本快照发布与一键回滚。
- **免费获客工具**：片名快检、备案导航（免登录）。
- **开放 API**：REST 检测端点（`Authorization: Bearer jhg_…`），支持接入自有生产管线。
- **商业化闭环**：订阅额度、留资线索、订单收款登记、后台管理（用户/规则/平台/订单/线索/运营总览）。

## 架构

```
┌───────────────────────────────────────────────────────────────┐
│                  应用层 (React 19 + Hono/tRPC 11)             │
│  送检工单 │ 报告/复诊 │ 备案材料 │ 通知中心 │ 开放API │ 后台   │
├───────────────────────────────────────────────────────────────┤
│                  检测引擎层 (纯 TypeScript，零外部依赖)        │
│  parser.ts 集-句解析 → matcher.ts 三通道匹配                   │
│  → orchestrator.ts 编排聚合 → llm.ts 可选LLM召回               │
│    (仅召回候选，判定权在规则引擎，LLM 命中降一级置信)          │
├───────────────────────────────────────────────────────────────┤
│                  规则与数据层 (Drizzle ORM + MySQL/MariaDB)    │
│  规则库(版本化+快照回滚) │ IP参照库 │ 平台配置 │ 自定义规则    │
└───────────────────────────────────────────────────────────────┘
```

**判定权边界**：LLM 通道只负责语义理解与候选召回，最终判定由规则引擎收口。未配置 LLM 环境变量时该通道自动关闭，规则引擎独立可用。

## 快速开始

### Docker Compose（推荐）

```bash
git clone https://github.com/echo07m/sieve.git && cd sieve
cp .env.example .env   # 填写 APP_ID / APP_SECRET / DB_ROOT_PASSWORD
./deploy.sh            # 或 docker compose up -d --build
# 打开 http://localhost:3000
```

数据库表结构在启动时自动迁移，19 条内置规则与 5 个平台配置自动播种，无需手工初始化。

### 源码开发

```bash
npm install
# 配置 .env 中 DATABASE_URL 后：
npm run build && npm start     # 生产
npm run dev                    # 开发（前后端热更新）
```

### 环境变量

见 [.env.example](.env.example)。Kimi OAuth 的 `APP_ID/APP_SECRET` 从 [Kimi 开放平台](https://open.kimi.com) 申请；`LLM_API_KEY` 可选项，不配置时 LLM 召回通道自动关闭。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19 · TypeScript · Vite · Tailwind CSS · shadcn/ui · react-i18next |
| 后端 | Hono · tRPC 11 · Drizzle ORM · MySQL/MariaDB · Kimi OAuth |
| 检测引擎 | 纯 TypeScript，零外部依赖（可独立移植） |
| 可选增强 | 兼容 OpenAI Chat Completions 的 LLM（默认 Moonshot/Kimi） |

## 开源协议 (License)

本项目采用 **Apache License 2.0 + 附加条款**（见 [LICENSE](LICENSE)）：

- ✅ 自由使用、修改、自托管，包括公司内部生产环境
- ✅ 单客户私有化部署与交付
- ❌ 未经许可不得作为**多租户 SaaS** 对外收费运营
- ❌ 不得使用「剧合规 / JuHeGui」商标于衍生产品（见 [NOTICE](NOTICE)）

商业授权、多租户 SaaS 运营授权与合作，请通过文末[联系方式](#联系方式-contact)洽谈。

## 赞助商 (Sponsors)

感谢以下伙伴对「剧合规」开源项目的支持。赞助与广告投放洽淡请见[联系方式](#联系方式-contact)。

<!-- ===== 广告位 AD SLOTS：以下展位长期预留，虚位以待 ===== -->

| 展位 | 位置 | 状态 |
| --- | --- | --- |
| 🥇 冠名赞助 | README 顶部横幅位（Logo + 一句话介绍） | **虚位以待** |
| 🥈 金牌赞助 | 本章节 Logo 墙 · 第 1 席 | **虚位以待** |
| 🥉 银牌赞助 | 本章节 Logo 墙 · 第 2 席 | **虚位以待** |
| ☕ 友情赞助 | 名单致谢（文字链） | **虚位以待** |

<!--
赞助上架指引：
1. 冠名位替换本文顶部 "AD SLOT" 注释块，建议图片宽度 ≤ 728px；
2. Logo 墙图片建议高度 64px，链接至赞助方官网；
3. 所有赞助内容须经维护方审核，且不得含有违法违规或引人误解的内容。
-->

## 联系方式 (Contact)

- **商务合作 / 商业授权 / 赞助与广告位**：📧 [macronet07@163.com](mailto:macronet07@163.com)
- **产品体验**：http://macrobit.com.cn
- **问题反馈**：GitHub Issues（规则口径类问题请附监管/平台原文出处）

## Star History

<!-- ===== 广告位 AD SLOT: Star History 图表（仓库公开后启用） ===== -->
<!-- [![Star History Chart](https://api.star-history.com/svg?repos=echo07m/sieve&type=Date)](https://star-history.com/#echo07m/sieve&Date) -->

如果这个项目对你有帮助，欢迎 Star ⭐ 支持！

## 贡献

欢迎 Issue 与 PR，请先阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。规则口径类贡献请附监管/平台原文出处，并正确标注 `official_text` / `vendor_interpretation` 置信度。

## 免责声明

本工具为上线前合规预检参考，**不构成过审保证**，最终以平台与监管审核为准。规则库中标注「企服解读」的口径请以广电总局原文复核。

---

## English

**JuHeGui** is a pre-launch compliance pre-check toolchain for AI-generated short dramas and comic-dramas (漫剧), built for studios, MCNs, and platform operators subject to China's micro-drama regulations.

**Highlights**

- Script scanning across 8 violation categories with episode/sentence-level evidence localization, policy citations, and remediation advice
- Rectification re-check loop: resubmit revised scripts and diff reports (resolved / persisting / new findings)
- Versioned, hash-sealed reports (SHA-256 + rule version), Word export
- Platform-specific rule overrides (Hongguo, Fanqie, Kuaishou, WeChat mini-programs)
- Filing guidance wizard (investment-based tiering per the 2026-01 standard) and auto-generated filing material packages
- GB 45438-2025 AI-content labeling checklist and validation
- Free tools (no login): title check & filing wizard; batch submissions; REST API
- Full commercialization back-office: subscriptions, leads, orders, admin console

**Quick start**: `cp .env.example .env` → fill in Kimi OAuth credentials → `./deploy.sh` → open http://localhost:3000.

**License**: Apache-2.0 **with Additional Terms** — free for self-hosting and internal production use; paid multi-tenant SaaS resale and trademark use require written permission. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

**Sponsors / Advertising**: Reserved sponsorship slots are available in this README (top banner & sponsor logo wall). All placements are subject to maintainer review.

**Contact**: Business licensing, partnerships, sponsorship & ad slots — 📧 [macronet07@163.com](mailto:macronet07@163.com). Live demo: http://macrobit.com.cn. Bug reports & rule-caliber questions: GitHub Issues.

**Disclaimer**: Pre-check results are advisory only and do not guarantee platform or regulatory approval.
