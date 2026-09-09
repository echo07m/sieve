/**
 * F8 版权自查：桥段级文本查重引擎（纯本地计算，不依赖外部服务）
 *
 * 原理：字符级 n-gram（shingle）+ containment 相似度
 *  - 总体相似度 = |待查 shingles ∩ 参照 shingles| / |待查 shingles|
 *  - 片段匹配：滑动窗口定位待查文本中与参照文本高度重合的连续片段
 */

/** 归一化：转小写、去除空白与标点符号（含中文标点），消除排版差异干扰 */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

/** 字符级 n-gram 集合（shingles） */
export function shingles(text: string, n = 8): Set<string> {
  const t = normalize(text);
  const set = new Set<string>();
  if (!t) return set;
  if (t.length <= n) {
    set.add(t);
    return set;
  }
  for (let i = 0; i + n <= t.length; i++) {
    set.add(t.slice(i, i + n));
  }
  return set;
}

export interface MatchSegment {
  targetExcerpt: string;
  refExcerpt: string;
  similarity: number;
}

const SHINGLE_N = 8;
/** 窗口相似度达到该阈值视为命中，连续命中合并为一个片段 */
const HIT_THRESHOLD = 0.4;
const MAX_SEGMENTS = 20;

/** 窗口文本的 shingle 集合对参照集合的 containment */
function containmentOf(windowSet: Set<string>, refSet: Set<string>): number {
  if (windowSet.size === 0) return 0;
  let inter = 0;
  for (const s of windowSet) if (refSet.has(s)) inter++;
  return inter / windowSet.size;
}

/**
 * 在归一化参照文本中，找出与目标片段 shingle 集合重合度最高的等长窗口。
 * 用差分数组统计每个参照起始位能覆盖的命中 shingle 数，避免 O(n·m) 全量滑窗。
 */
function bestRefWindow(ref: string, segSet: Set<string>, segLen: number): { start: number; score: number } {
  const winLen = Math.min(segLen, ref.length);
  if (winLen <= 0 || segSet.size === 0) return { start: 0, score: 0 };

  // 参照文本 shingle → 出现位置
  const posMap = new Map<string, number[]>();
  if (ref.length <= SHINGLE_N) {
    posMap.set(ref, [0]);
  } else {
    for (let p = 0; p + SHINGLE_N <= ref.length; p++) {
      const key = ref.slice(p, p + SHINGLE_N);
      const arr = posMap.get(key);
      if (arr) arr.push(p);
      else posMap.set(key, [p]);
    }
  }

  // shingle 出现在参照位置 p 时，覆盖起始位区间 [p - winLen + SHINGLE_N, p]
  const diff = new Float64Array(ref.length + 2);
  let hits = 0;
  for (const s of segSet) {
    const positions = posMap.get(s);
    if (!positions) continue;
    hits++;
    for (const p of positions) {
      const lo = Math.max(0, p - winLen + SHINGLE_N);
      diff[lo] += 1;
      diff[p + 1] -= 1;
    }
  }
  if (hits === 0) return { start: 0, score: 0 };

  let best = 0;
  let bestStart = 0;
  let cur = 0;
  const limit = ref.length - winLen;
  for (let i = 0; i <= limit; i++) {
    cur += diff[i];
    if (cur > best) {
      best = cur;
      bestStart = i;
    }
  }
  return { start: bestStart, score: best / segSet.size };
}

/**
 * 滑动窗口查找待查文本中与参照文本连续匹配的片段。
 * 返回按相似度降序、最多 20 段的 { targetExcerpt, refExcerpt, similarity }。
 */
export function findSegments(target: string, ref: string, windowSize = 30): MatchSegment[] {
  const t = normalize(target);
  const r = normalize(ref);
  if (!t || !r) return [];

  const refSet = new Set<string>();
  if (r.length <= SHINGLE_N) refSet.add(r);
  else for (let i = 0; i + SHINGLE_N <= r.length; i++) refSet.add(r.slice(i, i + SHINGLE_N));

  const win = Math.min(windowSize, t.length);
  const winCount = t.length - win + 1;
  const sims = new Float64Array(winCount);

  // 逐起始位计算窗口 containment
  for (let i = 0; i < winCount; i++) {
    const wSet = new Set<string>();
    const end = i + win;
    if (win <= SHINGLE_N) wSet.add(t.slice(i, end));
    else for (let j = i; j + SHINGLE_N <= end; j++) wSet.add(t.slice(j, j + SHINGLE_N));
    sims[i] = containmentOf(wSet, refSet);
  }

  // 连续命中区间合并为片段
  const segments: MatchSegment[] = [];
  let start = -1;
  const flush = (endExclusive: number) => {
    if (start < 0) return;
    const segText = t.slice(start, Math.min(endExclusive + win, t.length));
    const segSet = new Set<string>();
    if (segText.length <= SHINGLE_N) segSet.add(segText);
    else for (let j = 0; j + SHINGLE_N <= segText.length; j++) segSet.add(segText.slice(j, j + SHINGLE_N));

    const best = bestRefWindow(r, segSet, segText.length);
    const refLen = Math.min(segText.length, r.length);
    segments.push({
      targetExcerpt: segText,
      refExcerpt: r.slice(best.start, best.start + refLen),
      similarity: containmentOf(segSet, refSet),
    });
    start = -1;
  };
  for (let i = 0; i < winCount; i++) {
    if (sims[i] >= HIT_THRESHOLD) {
      if (start < 0) start = i;
    } else {
      flush(i);
    }
  }
  flush(winCount);

  return segments.sort((a, b) => b.similarity - a.similarity).slice(0, MAX_SEGMENTS);
}

/**
 * 总体查重：containment 相似度 + 匹配片段列表。
 * similarity 取值 0-1（|交集| / |待查 shingles|）。
 */
export function computeSimilarity(target: string, ref: string): { similarity: number; segments: MatchSegment[] } {
  const tSet = shingles(target);
  const rSet = shingles(ref);
  const similarity = containmentOf(tSet, rSet);
  return { similarity, segments: findSegments(target, ref) };
}
