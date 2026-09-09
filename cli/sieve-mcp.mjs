#!/usr/bin/env node
/**
 * sieve-mcp —— 剧合规（Sieve）MCP Server（stdio）
 *
 * 让 AI 编剧助手（Kimi CLI、Claude Code、Cursor 等支持 MCP 的工具）
 * 在写作过程中直接调用合规预检，实现「边写边检」的工具链闭环。
 *
 * 配置（环境变量）：
 *   SIEVE_API_KEY   jhg_ 前缀 API Key（必填）
 *   SIEVE_ENDPOINT  Sieve 服务地址（默认 http://localhost:3000）
 *
 * MCP 客户端配置示例（Claude Code / Cursor mcp.json）：
 *   {
 *     "mcpServers": {
 *       "sieve": {
 *         "command": "node",
 *         "args": ["cli/sieve-mcp.mjs"],
 *         "env": { "SIEVE_API_KEY": "jhg_…", "SIEVE_ENDPOINT": "https://your-sieve.com" }
 *       }
 *     }
 *   }
 *
 * 提供工具：
 *   sieve_detect        同步检测剧本（返回结论+命中清单+整改建议）
 *   sieve_detect_async  异步提交大剧本（返回 taskNo）
 *   sieve_get_task      查询异步任务结果
 *   sieve_usage         查询订阅额度用量
 *
 * 协议：MCP over stdio，换行分隔 JSON-RPC 2.0（2025-03-26 修订版兼容）。
 */

const API_KEY = process.env.SIEVE_API_KEY ?? "";
const ENDPOINT = (process.env.SIEVE_ENDPOINT ?? "http://localhost:3000").replace(/\/$/, "");
const PROTOCOL_VERSION = "2025-03-26";

function log(...a) {
  // 日志走 stderr，stdout 只承载协议帧
  console.error("[sieve-mcp]", ...a);
}

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

async function api(path, options = {}) {
  const resp = await fetch(`${ENDPOINT}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      ...(options.headers ?? {}),
    },
  });
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  return { status: resp.status, data };
}

const TOOLS = [
  {
    name: "sieve_detect",
    description:
      "对短剧/漫剧剧本做上线前合规预检（同步，秒级返回）。覆盖 8 大违规类别：涉儿童有害/软色情擦边/拜金炫富/畸形婚恋观/封建糟粕/暴力复仇/低俗片名/IP 魔改侵权，命中精确到集-句并附整改建议。",
    inputSchema: {
      type: "object",
      required: ["workTitle", "scriptText"],
      properties: {
        workTitle: { type: "string", description: "作品名称" },
        scriptText: { type: "string", description: "剧本全文（支持「第N集」分集标记，50-2000000 字）" },
        targetPlatform: {
          type: "string",
          enum: ["universal", "hongguo", "fanqie", "kuaishou", "wechat"],
          description: "目标平台差分口径，默认 universal",
        },
      },
    },
  },
  {
    name: "sieve_detect_async",
    description: "异步提交大型剧本检测（返回 taskNo，用 sieve_get_task 轮询结果）。",
    inputSchema: {
      type: "object",
      required: ["workTitle", "scriptText"],
      properties: {
        workTitle: { type: "string" },
        scriptText: { type: "string" },
        targetPlatform: { type: "string", enum: ["universal", "hongguo", "fanqie", "kuaishou", "wechat"] },
      },
    },
  },
  {
    name: "sieve_get_task",
    description: "查询异步检测任务的状态与结果。",
    inputSchema: {
      type: "object",
      required: ["taskNo"],
      properties: { taskNo: { type: "string", description: "任务号（DT- 前缀）" } },
    },
  },
  {
    name: "sieve_usage",
    description: "查询当前 API Key 对应订阅的额度用量（用于判断是否需要控量）。",
    inputSchema: { type: "object", properties: {} },
  },
];

function formatDetectResult(data) {
  const s = data.summary ?? {};
  const lines = [
    `【合规结论】${data.verdict}（命中 ${s.totalHits ?? 0} 条：阻断 ${s.blockCount ?? 0} / 高危 ${s.highCount ?? 0} / 提示 ${s.noticeCount ?? 0}）`,
    `规则版本 ${data.ruleVersion} ｜ 存证哈希 ${String(data.reportHash ?? "").slice(0, 16)}…`,
    "",
  ];
  for (const h of (data.hits ?? []).slice(0, 30)) {
    lines.push(`[${h.severity}] 第${h.episodeNo}集 ${h.location} · ${h.ruleCode}`);
    lines.push(`  片段：${String(h.spanText).slice(0, 80)}`);
    lines.push(`  建议：${String(h.remediation).slice(0, 120)}`);
  }
  if ((data.hits ?? []).length > 30) lines.push(`……另有 ${data.hits.length - 30} 条，详见完整报告`);
  lines.push("", data.disclaimer ?? "");
  return lines.join("\n");
}

async function callTool(name, args) {
  switch (name) {
    case "sieve_detect": {
      const { status, data } = await api("/api/v1/detect", {
        method: "POST",
        body: JSON.stringify({
          workTitle: args.workTitle,
          scriptText: args.scriptText,
          targetPlatform: args.targetPlatform ?? "universal",
        }),
      });
      if (status !== 200) return { text: `检测失败（HTTP ${status}）：${data.error ?? JSON.stringify(data)}`, isError: true };
      return { text: formatDetectResult(data) };
    }
    case "sieve_detect_async": {
      const { status, data } = await api("/api/v1/detect/async", {
        method: "POST",
        body: JSON.stringify({
          workTitle: args.workTitle,
          scriptText: args.scriptText,
          targetPlatform: args.targetPlatform ?? "universal",
        }),
      });
      if (status !== 202) return { text: `提交失败（HTTP ${status}）：${data.error ?? JSON.stringify(data)}`, isError: true };
      return { text: `任务已受理：${data.taskNo}\n请用 sieve_get_task 查询结果。${data.note ?? ""}` };
    }
    case "sieve_get_task": {
      const { status, data } = await api(`/api/v1/tasks/${encodeURIComponent(args.taskNo)}`);
      if (status !== 200) return { text: `查询失败（HTTP ${status}）：${data.error ?? JSON.stringify(data)}`, isError: true };
      if (data.status === "done") return { text: formatDetectResult(data.result) };
      if (data.status === "failed") return { text: `任务失败：${data.error}`, isError: true };
      return { text: `任务进行中（${data.status}），请稍后再次查询。` };
    }
    case "sieve_usage": {
      const { status, data } = await api("/api/v1/usage");
      if (status !== 200) return { text: `查询失败（HTTP ${status}）：${data.error ?? JSON.stringify(data)}`, isError: true };
      return {
        text: data.unlimited
          ? `方案：${data.planName}（不限量年框）｜ 已用 ${data.quotaUsed} 次 ｜ 状态 ${data.status}`
          : `方案：${data.planName} ｜ 额度 ${data.quotaUsed}/${data.quotaTotal}（剩余 ${data.quotaRemaining}）｜ 状态 ${data.status}`,
      };
    }
    default:
      return { text: `未知工具：${name}`, isError: true };
  }
}

async function handle(msg) {
  const { id, method, params } = msg;
  switch (method) {
    case "initialize":
      send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: params?.protocolVersion ?? PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: "sieve-mcp", version: "1.0.0" },
          instructions: API_KEY
            ? "剧合规预检工具已就绪：sieve_detect 边写边检，sieve_usage 查额度。"
            : "警告：未配置 SIEVE_API_KEY，调用检测工具将返回 401。",
        },
      });
      break;
    case "notifications/initialized":
    case "notifications/cancelled":
      break; // 无需响应
    case "ping":
      send({ jsonrpc: "2.0", id, result: {} });
      break;
    case "tools/list":
      send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
      break;
    case "tools/call": {
      const r = await callTool(params?.name, params?.arguments ?? {});
      send({
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: r.text }], isError: Boolean(r.isError) },
      });
      break;
    }
    default:
      if (id !== undefined) {
        send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
      }
  }
}

// stdio 主循环：换行分隔 JSON-RPC
let buffer = "";
process.stdin.setEncoding("utf-8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  for (;;) {
    const idx = buffer.indexOf("\n");
    if (idx < 0) break;
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    handle(msg).catch((e) => {
      if (msg.id !== undefined) {
        send({ jsonrpc: "2.0", id: msg.id, error: { code: -32000, message: e.message } });
      }
    });
  }
});

log(`sieve-mcp 已启动（endpoint=${ENDPOINT}，key=${API_KEY ? "已配置" : "未配置"}）`);
