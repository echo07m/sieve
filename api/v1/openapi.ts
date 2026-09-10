/**
 * OpenAPI 3.0 规范：GET /api/v1/openapi.json
 * 工具链衔接标准——任意集成方可据此生成客户端/契约测试。
 */
import type { Hono } from "hono";

const detectRequestBody = {
  required: true,
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["workTitle", "scriptText"],
        properties: {
          workTitle: { type: "string", maxLength: 255, description: "作品名称" },
          scriptText: { type: "string", minLength: 50, maxLength: 2000000, description: "剧本全文（支持「第N集」分集标记）" },
          targetPlatform: {
            type: "string",
            enum: ["universal", "hongguo", "fanqie", "kuaishou", "wechat"],
            default: "universal",
            description: "目标平台差分口径",
          },
          workType: { type: "string", maxLength: 64, description: "作品类型（可选）" },
        },
      },
    },
  },
};

const hitSchema = {
  type: "object",
  properties: {
    episodeNo: { type: "integer" },
    location: { type: "string", description: "集/场/句定位" },
    spanText: { type: "string", description: "命中片段原文" },
    category: {
      type: "string",
      enum: ["child_harm", "soft_porn", "money_worship", "marriage_distortion", "feudal_dregs", "violent_revenge", "vulgar_title", "ip_infringement"],
    },
    ruleCode: { type: "string" },
    severity: { type: "string", enum: ["block", "high", "notice"] },
    confidence: { type: "number" },
    basis: { type: "string", description: "依据条文" },
    remediation: { type: "string", description: "整改建议" },
  },
};

const detectResultSchema = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["high_risk", "attention", "low_risk"] },
    summary: {
      type: "object",
      properties: {
        totalHits: { type: "integer" },
        blockCount: { type: "integer" },
        highCount: { type: "integer" },
        noticeCount: { type: "integer" },
        byCategory: { type: "object", additionalProperties: { type: "integer" } },
        episodeCount: { type: "integer" },
        affectedEpisodes: { type: "integer" },
      },
    },
    hits: { type: "array", items: hitSchema },
    ruleVersion: { type: "string" },
    reportHash: { type: "string", description: "SHA-256 内容存证哈希" },
    disclaimer: { type: "string" },
  },
};

const errorSchema = {
  type: "object",
  properties: {
    error: { type: "string" },
    code: { type: "string" },
    details: { type: "array", items: { type: "string" } },
  },
};

export function buildOpenApiSpec(baseUrl = "") {
  return {
    openapi: "3.0.3",
    info: {
      title: "Sieve 剧合规 · 开放 API",
      description:
        "AI 短剧/漫剧上线前合规预检 REST API。鉴权：`Authorization: Bearer jhg_<48位hex>`。报告类导出（SARIF/JUnit/Word）见 Web 端；异步任务支持 Webhook 回调（HMAC-SHA256 签名）。",
      version: "1.0.0",
      contact: { email: "macronet07@163.com", url: "https://github.com/echo07m/sieve" },
      license: { name: "Apache-2.0 with Additional Terms", url: "https://github.com/echo07m/sieve/blob/main/LICENSE" },
    },
    servers: [{ url: baseUrl || "/" }],
    paths: {
      "/api/v1/detect": {
        post: {
          operationId: "detectSync",
          summary: "同步检测（秒级返回完整结果）",
          security: [{ bearerAuth: [] }],
          requestBody: detectRequestBody,
          responses: {
            "200": { description: "检测完成", content: { "application/json": { schema: detectResultSchema } } },
            "400": { description: "参数校验失败", content: { "application/json": { schema: errorSchema } } },
            "401": { description: "API Key 无效", content: { "application/json": { schema: errorSchema } } },
            "402": { description: "额度不足", content: { "application/json": { schema: errorSchema } } },
            "429": { description: "限流（60次/分钟/Key）", content: { "application/json": { schema: errorSchema } } },
          },
        },
      },
      "/api/v1/detect/async": {
        post: {
          operationId: "detectAsync",
          summary: "异步检测（返回 taskNo，轮询或 Webhook 获取结果）",
          security: [{ bearerAuth: [] }],
          requestBody: detectRequestBody,
          responses: {
            "202": {
              description: "任务已受理",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      taskNo: { type: "string" },
                      status: { type: "string", enum: ["pending"] },
                      pollUrl: { type: "string" },
                      note: { type: "string" },
                    },
                  },
                },
              },
            },
            "401": { description: "API Key 无效", content: { "application/json": { schema: errorSchema } } },
            "402": { description: "额度不足", content: { "application/json": { schema: errorSchema } } },
          },
        },
      },
      "/api/v1/tasks/{taskNo}": {
        get: {
          operationId: "getTask",
          summary: "查询异步任务状态与结果",
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: "taskNo", in: "path", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "任务状态",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      taskNo: { type: "string" },
                      status: { type: "string", enum: ["pending", "processing", "done", "failed"] },
                      workTitle: { type: "string" },
                      createdAt: { type: "string", format: "date-time" },
                      finishedAt: { type: "string", format: "date-time", nullable: true },
                      result: { ...detectResultSchema, nullable: true },
                      error: { type: "string" },
                    },
                  },
                },
              },
            },
            "404": { description: "任务不存在", content: { "application/json": { schema: errorSchema } } },
          },
        },
      },
      "/api/v1/usage": {
        get: {
          operationId: "getUsage",
          summary: "查询当前订阅额度用量（管线水位监控）",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "用量信息",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      planCode: { type: "string" },
                      planName: { type: "string" },
                      status: { type: "string" },
                      unlimited: { type: "boolean", description: "企业年框不限量" },
                      quotaTotal: { type: "integer", nullable: true },
                      quotaUsed: { type: "integer" },
                      quotaRemaining: { type: "integer", nullable: true },
                      expiresAt: { type: "string", format: "date-time", nullable: true },
                    },
                  },
                },
              },
            },
            "401": { description: "API Key 无效", content: { "application/json": { schema: errorSchema } } },
          },
        },
      },
      "/api/v1/storyboard": {
        post: {
          operationId: "createStoryboard",
          summary: "剧本分镜拆解（不消耗检测配额）：剧本 → 结构化分镜表 + 逐镜 agentPrompt",
          description:
            "把剧本文本拆解为分镜表，每镜含镜号/集/场景/景别/运镜/画面内容/台词/时长估算/情绪，" +
            "并附面向视频生成模型（即梦/可灵/Runway 等）的 agentPrompt，衔接「剧本→分镜→成片」流水线。",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["workTitle", "scriptText"],
                  properties: {
                    workTitle: { type: "string", maxLength: 255 },
                    scriptText: { type: "string", minLength: 10, maxLength: 2000000, description: "支持「第N集」分集标记与【场景】场景标记" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "分镜拆解结果",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      workTitle: { type: "string" },
                      episodeCount: { type: "integer" },
                      shotCount: { type: "integer" },
                      totalDurationSec: { type: "integer" },
                      engineVersion: { type: "string" },
                      shots: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            shotNo: { type: "integer" },
                            episodeNo: { type: "integer" },
                            scene: { type: "string" },
                            character: { type: "string" },
                            shotType: { type: "string", enum: ["long", "full", "medium", "close", "extreme_close"] },
                            cameraMove: { type: "string", enum: ["fixed", "push", "pull", "pan", "follow", "handheld"] },
                            visual: { type: "string" },
                            dialogue: { type: "string" },
                            durationSec: { type: "integer" },
                            mood: { type: "string" },
                            agentPrompt: { type: "string", description: "面向视频生成模型的单镜提示词" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            "400": { description: "参数校验失败", content: { "application/json": { schema: errorSchema } } },
            "401": { description: "API Key 无效", content: { "application/json": { schema: errorSchema } } },
            "422": { description: "无法拆解出有效镜头", content: { "application/json": { schema: errorSchema } } },
            "429": { description: "限流", content: { "application/json": { schema: errorSchema } } },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", description: "API Key：jhg_ 前缀 48 位 hex" },
      },
    },
    tags: [
      { name: "detect", description: "合规预检" },
      { name: "storyboard", description: "分镜拆解（送检前置）" },
    ],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerOpenApiRoute(app: Hono<any>): void {
  app.get("/api/v1/openapi.json", (c) => {
    const host = c.req.header("x-forwarded-host") ?? c.req.header("host") ?? "";
    const proto = c.req.header("x-forwarded-proto") ?? "http";
    return c.json(buildOpenApiSpec(host ? `${proto}://${host}` : ""));
  });
}
