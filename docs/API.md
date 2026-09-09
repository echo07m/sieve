# 开放 API 文档

「剧合规」开放 API 与网页端共用同一检测编排器（底座规则 + 该用户自定义加严规则叠加生效），当前提供文本（剧本）检测端点。

- Base URL：`https://your-host`（自建部署为你的服务域名）
- 端点：`POST /api/v1/detect`
- Content-Type：`application/json`

## 鉴权

使用 Bearer Token 鉴权：

```
Authorization: Bearer jhg_<48位小写hex>
```

API Key 在网页端「开放API」页签发（形如 `jhg_` + 48 位十六进制）。Key 可随时在网页端吊销，吊销后立即生效（401）。请妥善保管，服务端只存储 Key 的 SHA-256 哈希，无法找回明文。

## 限流与配额

- **限流**：单 Key 60 次/分钟（固定窗口），超限返回 429。
- **配额**：按订阅额度计量，每次成功调用扣减一次；企业年框不限量。额度用尽或订阅到期返回 402（`code: QUOTA_EXHAUSTED`）。

## 请求

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `workTitle` | string | 是 | 作品名称，1–255 字符 |
| `scriptText` | string | 是 | 剧本全文，50–2,000,000 字符；按「第N集」切分集，建议包含对白/旁白标记以提升定位精度 |
| `targetPlatform` | string | 否 | 目标平台，默认 `universal`；可选 `hongguo`（红果）、`fanqie`（番茄）、`kuaishou`（快手）、`wechat_mini`（微信小程序剧）等 |
| `workType` | string | 否 | 作品类型（如短剧/漫剧），≤64 字符，用于记录与统计 |

## 响应

成功（HTTP 200）返回 JSON：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `verdict` | string | 整体结论：`high_risk`（高风险须整改，存在 block 命中）/ `attention`（需关注，存在 high 命中）/ `low_risk`（低风险） |
| `summary` | object | 汇总：`totalHits`、`blockCount`、`highCount`、`noticeCount`、`byCategory`（各类别命中数）、`episodeCount`、`affectedEpisodes` |
| `hits` | array | 命中明细，见下表 |
| `ruleVersion` | string | 本次检测使用的规则库版本（存证用） |
| `reportHash` | string | 报告 SHA-256 存证哈希（hits + ruleVersion + 时间戳） |
| `disclaimer` | string | 固定免责声明：预检参考，最终以平台/监管审核为准 |

`hits[]` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `episodeNo` | number | 所在集号 |
| `location` | string | 位置描述，如「第3集」 |
| `spanText` | string | 命中片段原文（≤120 字） |
| `category` | string | 类别：`child_harm` / `soft_porn` / `money_worship` / `marriage_distortion` / `feudal_dregs` / `violent_revenge` / `vulgar_title` / `ip_infringement` |
| `ruleCode` | string | 命中规则编号，如 `R2-2026-001` |
| `severity` | string | 严重级：`block` / `high` / `notice`（已含平台差分调整；LLM 召回命中自动降一级） |
| `confidence` | number | 置信度，0–1（保留两位小数） |
| `basis` | string | 判定依据：政策出处 + 条款 + 原文 |
| `remediation` | string | 整改建议 |

## 错误码

| HTTP | 场景 | 响应体 |
| --- | --- | --- |
| 400 | 请求体非法 JSON / 参数校验失败 | `{ "error": "…", "details": ["…"] }` |
| 401 | 缺少或格式错误的 Key；Key 无效或已吊销 | `{ "error": "…" }` |
| 402 | 检测额度用尽或订阅到期 | `{ "error": "…", "code": "QUOTA_EXHAUSTED" }` |
| 429 | 超过 60 次/分钟限流 | `{ "error": "请求过于频繁…" }` |
| 500 | 检测执行失败 | `{ "error": "检测执行失败，请稍后重试" }` |

## 示例

```bash
curl -X POST https://your-host/api/v1/detect \
  -H "Authorization: Bearer jhg_0123456789abcdef0123456789abcdef0123456789abcdef" \
  -H "Content-Type: application/json" \
  -d '{
    "workTitle": "示例短剧",
    "scriptText": "第1集\n△旁白：他一脚踹开酒店房门。\n张三：今晚你逃不掉了……",
    "targetPlatform": "hongguo",
    "workType": "短剧"
  }'
```

响应示例（节选）：

```json
{
  "verdict": "attention",
  "summary": {
    "totalHits": 2,
    "blockCount": 0,
    "highCount": 2,
    "noticeCount": 0,
    "byCategory": { "soft_porn": 1, "violent_revenge": 1 },
    "episodeCount": 1,
    "affectedEpisodes": 1
  },
  "hits": [
    {
      "episodeNo": 1,
      "location": "第1集",
      "spanText": "△旁白：他一脚踹开酒店房门。",
      "category": "soft_porn",
      "ruleCode": "R2-2026-001",
      "severity": "high",
      "confidence": 0.8,
      "basis": "广电总局有害低俗与侵权盗版专项治理部署｜8类问题之二：软色情擦边：聚焦软色情擦边等8类问题",
      "remediation": "命中软色情擦边判定（依据：专项治理8类问题之二）。建议删除身体部位特写与性暗示描写，改为情节推进型表达；亲密情节以留白或转场处理。"
    }
  ],
  "ruleVersion": "2026.09-v1",
  "reportHash": "ab12cd…（64位hex）",
  "disclaimer": "本报告为上线前预检参考，不构成法律意见，最终以平台/监管审核为准。"
}
```

> 注：LLM 语义召回通道仅在部署方配置了 LLM 环境变量时启用；其召回命中置信度封顶并自动降级一级，最终判定权始终在规则引擎。

## 异步检测（POST /api/v1/detect/async）

与同步端点同参数，立即返回任务号（HTTP 202），后台执行检测：

```json
{ "taskNo": "DT-20260909-00000100", "status": "pending", "pollUrl": "/api/v1/tasks/DT-20260909-00000100" }
```

**轮询结果**：`GET /api/v1/tasks/{taskNo}`（同一 Bearer Key 鉴权），`status` 为
`pending/processing/done/failed`；`done` 时 `result` 与同步端点响应同构。失败任务自动退还额度。

## Webhook 回调

在「工作台 → Webhook回调」配置端点后，任务完成会向你的服务器 POST 推送事件：

- 事件：`detect.done` / `detect.failed` / `test.ping`（连通测试）
- 请求头：`X-Sieve-Event`、`X-Sieve-Delivery`、`X-Sieve-Timestamp`、`X-Sieve-Signature`
- 签名：`X-Sieve-Signature = "sha256=" + HMAC_SHA256(端点签名密钥, 原始请求体)`，接收端务必验签
- 重推：失败按 1/4/9/16 分钟退避重推，最多 5 次；投递日志支持手动重推

请求体结构：`{ "event": "detect.done", "data": { "taskNo", "status", "workTitle", "result" }, "timestamp" }`
