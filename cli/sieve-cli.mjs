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
 *   --convert <fmt>      格式转换模式：fountain|fdx（Final Draft）→ Sieve Script JSON，不调用 API
 *   --usage              查询订阅额度用量（GET /api/v1/usage）后退出
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
      case "--convert": args.convert = next(); break;
      case "--usage": args.usage = true; break;
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

// ============ 编剧格式转换：Fountain / Final Draft(.fdx) → Sieve Script JSON ============

/** 通用：元素流转分集文本；识别「第N集/EP N」标记自动分集 */
function elementsToScript(elements) {
  const episodes = [];
  let cur = { episodeNo: 1, title: "", lines: [] };
  const pushEpisode = () => {
    if (cur.lines.length > 0) episodes.push(cur);
  };
  for (const el of elements) {
    const m = el.text.match(/(?:第\s*(\d+)\s*集|EP\s*0*(\d+))/i);
    if (m && (el.kind === "scene" || el.kind === "section")) {
      pushEpisode();
      cur = { episodeNo: Number(m[1] ?? m[2]), title: el.text.trim(), lines: [] };
      continue;
    }
    if (el.kind === "section") {
      pushEpisode();
      cur = { episodeNo: episodes.length + 1, title: el.text.replace(/^#+\s*/, "").trim(), lines: [] };
      continue;
    }
    if (el.kind === "scene") cur.lines.push(`【场景】${el.text}`);
    else if (el.kind === "character") cur.lines.push(`${el.text}：${el.dialogue ?? ""}`.trim());
    else if (el.kind === "transition") cur.lines.push(`【转场】${el.text}`);
    else cur.lines.push(el.text);
  }
  pushEpisode();
  return episodes.map((e, i) => ({
    episodeNo: e.episodeNo || i + 1,
    title: e.title.replace(/^#+\s*/, ""),
    content: e.lines.join("\n"),
  }));
}

/** Fountain 纯文本剧本格式解析（https://fountain.io） */
function parseFountain(text) {
  const elements = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^#{1,3}\s/.test(trimmed)) { elements.push({ kind: "section", text: trimmed }); continue; }
    if (/^(.|INT\.|EXT\.|EST\.|INT\/EXT\.|I\/E\.)/i.test(trimmed) && /^(\.|INT|EXT|EST|I\/E)/i.test(trimmed)) {
      elements.push({ kind: "scene", text: trimmed.replace(/^\./, "") }); continue;
    }
    if (/TO:$/.test(trimmed) && trimmed === trimmed.toUpperCase()) {
      elements.push({ kind: "transition", text: trimmed }); continue;
    }
    // 角色行：全大写（含中文角色名后跟对白的情况单独处理）
    if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed) && trimmed.length <= 40) {
      const dialogue = [];
      while (i + 1 < lines.length && lines[i + 1].trim() && lines[i + 1].trim() !== lines[i + 1].trim().toUpperCase()) {
        dialogue.push(lines[++i].trim());
      }
      elements.push({ kind: "character", text: trimmed, dialogue: dialogue.join(" ") });
      continue;
    }
    // 中文角色名：短行（≤12字、不以句读结尾）且下一行非空 → 角色提示行
    if (
      trimmed.length <= 12 && !/[。！？，、；：:）)\]]$/.test(trimmed) &&
      i + 1 < lines.length && lines[i + 1].trim() &&
      !/^(INT\.|EXT\.|EST\.|#)/i.test(lines[i + 1].trim())
    ) {
      const dialogue = [];
      while (i + 1 < lines.length && lines[i + 1].trim()) {
        const nl = lines[i + 1].trim();
        if (/^(INT\.|EXT\.|EST\.|#)/i.test(nl) || /TO:$/.test(nl)) break;
        dialogue.push(lines[++i].trim());
      }
      elements.push({ kind: "character", text: trimmed, dialogue: dialogue.join(" ").replace(/[（(]/g, "（").replace(/[）)]/g, "）") });
      continue;
    }
    // 中文剧本常见「角色：台词」格式
    const cm = trimmed.match(/^([^\s：:]{1,12})[：:](.+)$/);
    if (cm) { elements.push({ kind: "character", text: cm[1], dialogue: cm[2].trim() }); continue; }
    elements.push({ kind: "action", text: trimmed });
  }
  return elements;
}

/** Final Draft .fdx（XML）解析：Paragraph Type 映射 */
function parseFdx(xml) {
  const elements = [];
  const paraRe = /<Paragraph(?:\s+Type="([^"]*)")?[^>]*>([\s\S]*?)<\/Paragraph>/g;
  let m;
  while ((m = paraRe.exec(xml)) !== null) {
    const type = m[1] ?? "";
    const text = m[2].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
    if (!text) continue;
    if (/Scene Heading/i.test(type)) elements.push({ kind: "scene", text });
    else if (/Character/i.test(type)) elements.push({ kind: "character", text, dialogue: "" });
    else if (/Dialogue/i.test(type)) {
      const last = elements[elements.length - 1];
      if (last?.kind === "character") last.dialogue = `${last.dialogue ?? ""} ${text}`.trim();
      else elements.push({ kind: "action", text });
    }
    else if (/Transition/i.test(type)) elements.push({ kind: "transition", text });
    else elements.push({ kind: "action", text });
  }
  return elements;
}

async function queryUsage(endpoint, key) {
  const resp = await fetch(`${endpoint}/api/v1/usage`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!resp.ok) {
    console.error(`查询失败：HTTP ${resp.status} ${await resp.text()}`);
    process.exit(1);
  }
  const u = await resp.json();
  console.log(`方案：${u.planName}（${u.planCode}）｜ 状态：${u.status}`);
  if (u.unlimited) console.log(`额度：不限量（企业年框）｜ 已用 ${u.quotaUsed} 次`);
  else console.log(`额度：${u.quotaUsed}/${u.quotaTotal}（剩余 ${u.quotaRemaining}）`);
  if (u.expiresAt) console.log(`到期：${u.expiresAt}`);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || (!args.file && !args.usage)) {
    console.log(readFileSync(new URL(import.meta.url), "utf-8").split("*/")[0].split("/**")[1]);
    process.exit(args.help ? 0 : 1);
  }
  const key = args.key ?? process.env.SIEVE_API_KEY;
  const endpoint = (args.endpoint ?? process.env.SIEVE_ENDPOINT ?? "http://localhost:3000").replace(/\/$/, "");

  // 格式转换模式：不调用检测 API
  if (args.convert) {
    if (!args.file) { console.error("--convert 需要 --file"); process.exit(1); }
    const raw = readFileSync(args.file, "utf-8");
    const elements = args.convert === "fdx" ? parseFdx(raw) : args.convert === "fountain" ? parseFountain(raw) : null;
    if (!elements) { console.error("--convert 仅支持 fountain|fdx"); process.exit(1); }
    if (elements.length === 0) { console.error("未能从文件中解析出任何剧本元素"); process.exit(1); }
    const episodes = elementsToScript(elements);
    const out = JSON.stringify({ episodes }, null, 2);
    if (args.output) {
      writeFileSync(args.output, out);
      console.error(`已转换 ${episodes.length} 集 → ${args.output}（Sieve Script JSON，可直接 --file 送检）`);
    } else {
      console.log(out);
    }
    process.exit(0);
  }

  if (args.usage) {
    if (!key) { console.error("缺少 API Key：--key 或环境变量 SIEVE_API_KEY"); process.exit(1); }
    await queryUsage(endpoint, key);
    process.exit(0);
  }

  if (!key) {
    console.error("缺少 API Key：--key 或环境变量 SIEVE_API_KEY");
    process.exit(1);
  }
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
