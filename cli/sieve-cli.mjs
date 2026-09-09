#!/usr/bin/env node
/**
 * sieve-cli —— 剧合规（Sieve）工具链命令行
 *
 * 将剧本合规预检嵌入任意生产管线/CI：读取剧本文件 → 调开放 API → 按严重级阈值给出退出码。
 * 零依赖（Node.js ≥ 18，内置 fetch）。
 *
 * 用法：
 *   node cli/sieve-cli.mjs --file 剧本.txt --key jhg_xxx [选项]
 *
 * 选项：
 *   --file <path>        剧本文件（.txt/.md/.json，JSON 需为 {episodes:[{episodeNo,title,content}]}）
 *   --key <jhg_...>      API Key（或环境变量 SIEVE_API_KEY）
 *   --endpoint <url>     API 基地址（默认 http://localhost:3000，或 SIEVE_ENDPOINT）
 *   --title <name>       作品名（默认取文件名）
 *   --platform <p>       universal|hongguo|fanqie|kuaishou|wechat（默认 universal）
 *   --async              走异步接口并轮询（大剧本推荐）
 *   --poll-interval <ms> 异步轮询间隔（默认 2000）
 *   --fail-on <level>    block|high|notice|never（默认 block）：命中≥该级别即退出码 2
 *   --format <fmt>       text|json|sarif|junit（默认 text）：结果输出格式
 *   --output <path>      将 --format 结果写入文件而非 stdout
 *   -h, --help           帮助
 *
 * 退出码：0=通过  1=执行错误  2=命中阈值（合规门禁拦截）
 *
 * CI 示例（GitHub Actions）见 docs/工具链集成.md。
 */

import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const SEV_ORDER = { block: 3, high: 2, notice: 1 };
const SEV_LABEL = { block: "阻断", high: "高危", notice: "提示" };

function parseArgs(argv) {
  const args = { platform: "universal", failOn: "block", format: "text", async: false, pollInterval: 2000 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "--file": args.file = next(); break;
      case "--key": args.key = next(); break;
      case "--endpoint": args.endpoint = next(); break;
      case "--title": args.title = next(); break;
      case "--platform": args.platform = next(); break;
      case "--async": args.async = true; break;
      case "--poll-interval": args.pollInterval = Number(next()); break;
      case "--fail-on": args.failOn = next(); break;
      case "--format": args.format = next(); break;
      case "--output": args.output = next(); break;
      case "-h": case "--help": args.help = true; break;
      default:
        console.error(`未知参数：${a}`);
        process.exit(1);
    }
  }
  return args;
}

function loadScript(file) {
  const raw = readFileSync(file, "utf-8");
  if (file.endsWith(".json")) {
    const data = JSON.parse(raw);
    if (Array.isArray(data.episodes)) {
      // Sieve Script JSON 标准格式：{episodes:[{episodeNo,title,content}]}
      return data.episodes
        .map((e) => `第${e.episodeNo}集 ${e.title ?? ""}\n${e.content ?? ""}`)
        .join("\n\n");
    }
    throw new Error("JSON 格式须为 {episodes:[{episodeNo,title,content}]}（Sieve Script JSON）");
  }
  return raw;
}

function toSarif(result, title) {
  const levelMap = { block: "error", high: "warning", notice: "note" };
  const rules = new Map();
  for (const h of result.hits) {
    if (!rules.has(h.ruleCode)) rules.set(h.ruleCode, { code: h.ruleCode, severity: h.severity });
  }
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [{
      tool: {
        driver: {
          name: "Sieve 剧合规",
          version: result.ruleVersion ?? "unknown",
          informationUri: "https://github.com/echo07m/sieve",
          rules: [...rules.values()].map((r) => ({
            id: r.code,
            defaultConfiguration: { level: levelMap[r.severity] ?? "warning" },
          })),
        },
      },
      results: result.hits.map((h) => ({
        ruleId: h.ruleCode,
        level: levelMap[h.severity] ?? "warning",
        message: { text: `[第${h.episodeNo}集 ${h.location}] ${h.spanText}。整改建议：${h.remediation}` },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: `${title}.txt`, uriBaseId: "SRCROOT" },
            region: { startLine: h.episodeNo },
          },
        }],
      })),
    }],
  };
}

function toJunit(result) {
  const esc = (s) => String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;")
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
  const fails = result.hits.filter((h) => SEV_ORDER[h.severity] >= SEV_ORDER.high).length;
  const cases = result.hits.map((h) => {
    const fail = SEV_ORDER[h.severity] >= SEV_ORDER.high;
    const name = `${h.ruleCode} @ 第${h.episodeNo}集 ${h.location}`;
    return fail
      ? `  <testcase classname="${esc(h.category)}" name="${esc(name)}">\n    <failure message="${esc(h.ruleCode)}" type="${h.severity}">${esc(`${h.spanText}\n${h.remediation}`)}</failure>\n  </testcase>`
      : `  <testcase classname="${esc(h.category)}" name="${esc(name)}"/>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="sieve-precheck" tests="${result.hits.length}" failures="${fails}" errors="0">
${cases.join("\n")}
</testsuite>
`;
}

function renderText(result, threshold) {
  const s = result.summary;
  const lines = [
    `═══ 剧合规预检结果 ═══`,
    `结论：${result.verdict} ｜ 命中 ${s.totalHits} 条（阻断 ${s.blockCount} / 高危 ${s.highCount} / 提示 ${s.noticeCount}）`,
    `规则版本：${result.ruleVersion} ｜ 存证哈希：${result.reportHash?.slice(0, 16)}…`,
    ``,
  ];
  for (const h of result.hits) {
    lines.push(`[${SEV_LABEL[h.severity] ?? h.severity}] 第${h.episodeNo}集 ${h.location} · ${h.ruleCode}`);
    lines.push(`  片段：${String(h.spanText).slice(0, 80)}`);
    lines.push(`  建议：${String(h.remediation).slice(0, 100)}`);
  }
  lines.push(``, result.disclaimer ?? "");
  const breached = result.hits.some((h) => SEV_ORDER[h.severity] >= SEV_ORDER[threshold]);
  lines.push(breached ? `✖ 门禁未通过：存在 ≥「${SEV_LABEL[threshold]}」级命中` : `✔ 门禁通过（阈值：${SEV_LABEL[threshold]}）`);
  return lines.join("\n");
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.file) {
    console.log(readFileSync(new URL(import.meta.url), "utf-8").split("*/")[0].split("/**")[1]);
    process.exit(args.help ? 0 : 1);
  }
  const key = args.key ?? process.env.SIEVE_API_KEY;
  if (!key) {
    console.error("缺少 API Key：--key 或环境变量 SIEVE_API_KEY");
    process.exit(1);
  }
  const endpoint = (args.endpoint ?? process.env.SIEVE_ENDPOINT ?? "http://localhost:3000").replace(/\/$/, "");
  const title = args.title ?? basename(args.file).replace(/\.[^.]+$/, "");
  const scriptText = loadScript(args.file);
  const body = JSON.stringify({ workTitle: title, scriptText, targetPlatform: args.platform });
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${key}` };

  let result;
  if (args.async) {
    const resp = await fetch(`${endpoint}/api/v1/detect/async`, { method: "POST", headers, body });
    if (resp.status !== 202) {
      console.error(`提交失败：HTTP ${resp.status} ${await resp.text()}`);
      process.exit(1);
    }
    const { taskNo } = await resp.json();
    console.error(`任务已受理：${taskNo}，轮询中…`);
    for (;;) {
      await new Promise((r) => setTimeout(r, args.pollInterval));
      const t = await fetch(`${endpoint}/api/v1/tasks/${taskNo}`, { headers });
      const data = await t.json();
      if (data.status === "done") { result = data.result; break; }
      if (data.status === "failed") {
        console.error(`检测失败：${data.error}`);
        process.exit(1);
      }
    }
  } else {
    const resp = await fetch(`${endpoint}/api/v1/detect`, { method: "POST", headers, body });
    if (!resp.ok) {
      console.error(`检测失败：HTTP ${resp.status} ${await resp.text()}`);
      process.exit(1);
    }
    result = await resp.json();
  }

  let out;
  if (args.format === "json") out = JSON.stringify(result, null, 2);
  else if (args.format === "sarif") out = JSON.stringify(toSarif(result, title), null, 2);
  else if (args.format === "junit") out = toJunit(result);
  else out = renderText(result, args.failOn);

  if (args.output) {
    writeFileSync(args.output, out);
    console.error(`已写入 ${args.output}`);
    // 门禁判定仍输出到 stderr
    console.error(renderText(result, args.failOn).split("\n").pop());
  } else {
    console.log(out);
  }

  const breached = result.hits.some((h) => SEV_ORDER[h.severity] >= SEV_ORDER[args.failOn]);
  process.exit(breached ? 2 : 0);
}

main().catch((e) => {
  console.error(`执行错误：${e.message}`);
  process.exit(1);
});
