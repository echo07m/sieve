/**
 * 剧本解析器：将剧本文本解析为 集—句 结构
 * 支持常见格式：第X集 / 第X集：标题 / EP01 / 【第X集】等；
 * 无分集标记时按行数切分为逻辑集（约40行一集）。
 */

export interface ScriptLine {
  episodeNo: number;
  episodeTitle: string;
  lineNo: number; // 集内行号
  text: string;
  kind: "title" | "dialogue" | "narration";
  timecode?: string; // 字幕模式下的时间码（如 00:01:23,500 --> 00:01:26,000）
}

export interface ParsedScript {
  workTitle: string;
  lines: ScriptLine[];
  episodeCount: number;
  episodeTitles: Record<number, string>;
}

const EPISODE_RE =
  /^(?:【?\s*(?:第\s*([0-9一二两三四五六七八九十百零]+)\s*[集话章]|EP\.?\s*(\d+)|E(\d+))\s*】?\s*[::：]?\s*(.*)|集\s*([0-9]+)\s*[::：]\s*(.*))$/i;

function cnToNum(s: string): number {
  const map: Record<string, number> = {
    零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
  };
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  // 简易中文数字：十X / X十 / X十Y / X百零Y / 百以内
  if (s.includes("百")) {
    const [h, rest] = s.split("百");
    // “一百零一”：百位后余“零一”，零仅作占位，按个位处理
    const tail = rest?.startsWith("零") ? rest.slice(1) : rest;
    return (map[h] ?? 1) * 100 + (tail ? cnToNum(tail) : 0);
  }
  if (s.startsWith("零") && s.length > 1) return cnToNum(s.slice(1));
  if (s.includes("十")) {
    const [t, u] = s.split("十");
    return (t ? (map[t] ?? 1) : 1) * 10 + (u ? (map[u] ?? 0) : 0);
  }
  return map[s] ?? 0;
}

function classifyLine(text: string): ScriptLine["kind"] {
  // 台词：含冒号的角色对白，如 "张三：……" 或 "张三（愤怒）：……"
  if (/^[\p{Script=Han}A-Za-z0-9·]{1,12}[（(][^）)]{1,10}[）)][::：]/u.test(text)) return "dialogue";
  if (/^[\p{Script=Han}A-Za-z0-9·]{1,10}[::：]/u.test(text)) return "dialogue";
  return "narration";
}

const SRT_TC_RE =
  /^(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/;
const SRT_INDEX_RE = /^\d{1,6}$/;

export function parseScript(raw: string): ParsedScript {
  const normalized = raw.replace(/\r\n?/g, "\n");
  const rawLines = normalized.split("\n");
  const lines: ScriptLine[] = [];
  const episodeTitles: Record<number, string> = {};
  let episodeNo = 0;
  let episodeTitle = "";
  let lineNo = 0;
  let workTitle = "";
  let pendingTimecode: string | undefined;
  let markerCount = 0; // 真实集标记数量（用于判断是否按行数兜底切分）

  // 尝试从首部提取作品名：《XXX》或 "片名：XXX" / "剧名：XXX"
  const head = rawLines.slice(0, 10).join("\n");
  const titleM =
    head.match(/[《「]([^》」]{2,40})[》」]/) ||
    head.match(/(?:片名|剧名|作品名)[::：]\s*([^\n]{2,40})/);
  if (titleM) workTitle = titleM[1].trim();

  for (let i = 0; i < rawLines.length; i++) {
    const text = rawLines[i].trim();
    if (!text) continue;

    // SRT 序号行：仅当下一非空行是时间码时才跳过（纯数字台词不当序号吞掉）
    if (SRT_INDEX_RE.test(text) && !pendingTimecode) {
      const next = rawLines.slice(i + 1).find((l) => l.trim());
      if (next && SRT_TC_RE.test(next.trim())) continue;
    }
    // SRT 时间码行：暂存，附加到下一条文本
    const tc = text.match(SRT_TC_RE);
    if (tc) {
      pendingTimecode = `${tc[1]} --> ${tc[2]}`;
      continue;
    }

    const m = text.match(EPISODE_RE);
    if (m) {
      const numStr = m[1] ?? m[2] ?? m[3] ?? m[5] ?? "";
      const n = cnToNum(numStr);
      episodeNo = n > 0 ? n : episodeNo + 1;
      markerCount += 1;
      episodeTitle = (m[4] ?? m[6] ?? "").trim();
      episodeTitles[episodeNo] = episodeTitle;
      lineNo = 0;
      // 集标题本身纳入检测（低俗片名规则 scope 含 episode_title）
      if (episodeTitle) {
        lines.push({ episodeNo, episodeTitle, lineNo: 0, text: episodeTitle, kind: "title" });
      }
      continue;
    }
    if (episodeNo === 0) {
      // 尚未遇到任何集标记
      episodeNo = 1;
      episodeTitles[1] = episodeTitles[1] ?? "";
    }
    lineNo += 1;
    lines.push({
      episodeNo,
      episodeTitle,
      lineNo,
      text,
      kind: classifyLine(text),
      timecode: pendingTimecode,
    });
    pendingTimecode = undefined;
  }

  // 完全无分集标记的兜底：按 40 行一个逻辑集切分（有 1 个标记即按标记切分）
  if (markerCount === 0 && lines.length > 60) {
    lines.forEach((l, i) => {
      l.episodeNo = Math.floor(i / 40) + 1;
    });
  }

  const episodeCount = Math.max(1, ...lines.map((l) => l.episodeNo));
  return { workTitle, lines, episodeCount, episodeTitles };
}

/** 提取作品片名候选（供 title scope 规则检测） */
export function extractPromoTitle(parsed: ParsedScript, fallback: string): string {
  return parsed.workTitle || fallback;
}
