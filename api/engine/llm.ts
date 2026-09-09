/**
 * LLM 语义审查通道（预留接口）
 *
 * 架构约定（开发文档 3.1.2 判定权边界）：LLM 只负责语义理解与候选召回，
 * 最终判定由规则引擎收口。本通道的输出会被映射到既有规则条目上，
 * LLM 不得发明规则库之外的违规类别。
 *
 * 启用方式：在环境变量中配置
 *   LLM_API_KEY      大模型 API Key
 *   LLM_API_BASE     兼容 OpenAI Chat Completions 的端点（默认 Moonshot）
 *   LLM_MODEL        模型名（默认 moonshot-v1-32k）
 * 未配置时该通道自动降级为空结果，规则引擎独立可用。
 */

export interface LlmCandidate {
  episodeNo: number;
  spanText: string;
  category:
    | "child_harm" | "soft_porn" | "money_worship" | "marriage_distortion"
    | "feudal_dregs" | "violent_revenge" | "vulgar_title" | "ip_infringement";
  rationale: string;
}

export function isLlmEnabled(): boolean {
  return Boolean(process.env.LLM_API_KEY);
}

/**
 * 对单集文本做语义候选召回。未配置 API Key 时返回空数组。
 * 失败（超时/限流/解析错误）同样返回空数组——双通道设计中 LLM 是增强项而非依赖项。
 */
export async function llmRecallEpisode(
  episodeNo: number,
  episodeText: string,
): Promise<LlmCandidate[]> {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return [];
  const base = process.env.LLM_API_BASE ?? "https://api.moonshot.cn/v1";
  const model = process.env.LLM_MODEL ?? "moonshot-v1-32k";

  const prompt = [
    "你是短剧内容合规预检助手。请审阅以下剧本集内容，识别可能触碰以下8类问题的片段：",
    "涉儿童有害、软色情擦边、拜金炫富、畸形婚恋观、封建糟粕、暴力复仇、低俗片名、侵权盗版。",
    "只输出 JSON 数组，每项含 spanText（原文片段，≤60字）、category（英文键名）、rationale（一句话理由）。",
    "无命中输出 []。不要输出任何其他文字。",
    "---",
    episodeText.slice(0, 12000),
  ].join("\n");

  try {
    const resp = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!resp.ok) return [];
    const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "";
    const m = content.match(/\[[\s\S]*\]/);
    if (!m) return [];
    const arr = JSON.parse(m[0]) as Omit<LlmCandidate, "episodeNo">[];
    return (Array.isArray(arr) ? arr : []).map((c) => ({ ...c, episodeNo }));
  } catch {
    return [];
  }
}
