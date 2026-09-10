/**
 * 分镜拆解引擎：把剧本文本拆解为结构化分镜表（shot list）。
 *
 * 定位：送检前置环节。编剧完成剧本后，先拆成分镜 → 每镜附带面向
 * 视频生成 agent（即梦/可灵/Runway/Pika 等文生视频模型）的 agentPrompt，
 * 实现「剧本 → 分镜 → 成片」的流水线衔接。
 *
 * 设计原则：确定性规则拆解（可复现、可审计），不依赖 LLM；
 * 未来可在本模块内叠加 LLM 润色通道（与 engine/llm.ts 同约定：增强项而非依赖项）。
 */

import { parseScript } from "./parser";

export type ShotType =
  | "long" // 远景：交代环境
  | "full" // 全景：人物全身/动作
  | "medium" // 中景：人物膝盖以上，叙事主力
  | "close" // 近景：表情与台词
  | "extreme_close"; // 特写：情绪爆点/关键道具

export type CameraMove = "fixed" | "push" | "pull" | "pan" | "follow" | "handheld";

export interface StoryboardShot {
  shotNo: number; // 全剧连续镜号
  episodeNo: number;
  scene: string; // 场景描述（无场景标记时为「默认场景」）
  character: string; // 出场角色（台词行提取，可为空）
  shotType: ShotType;
  cameraMove: CameraMove;
  visual: string; // 画面内容（给视频模型的主体描述）
  dialogue: string; // 台词/旁白（可空）
  durationSec: number; // 时长估算
  mood: string; // 情绪氛围
  agentPrompt: string; // 面向视频生成模型的单镜提示词
}

export interface Storyboard {
  workTitle: string;
  episodeCount: number;
  shotCount: number;
  totalDurationSec: number;
  shots: StoryboardShot[];
  engineVersion: string;
}

export const STORYBOARD_ENGINE_VERSION = "sb-2026.09-v1";

const SCENE_RE = /^(?:【场景】\s*|场景[::：]\s*|\[场景\]\s*)(.+)$/i;
const FOUNTAIN_SCENE_RE = /^(INT\.|EXT\.|EST\.|INT\.\/EXT\.)\s*(.+)$/i;
const DIALOGUE_RE = /^([\p{Script=Han}A-Za-z0-9·]{1,12})(?:[（(]([^）)]{1,10})[）)])?[::：]\s*(.+)$/u;

const SHOT_TYPE_CN: Record<ShotType, string> = {
  long: "远景",
  full: "全景",
  medium: "中景",
  close: "近景",
  extreme_close: "特写",
};

const CAMERA_MOVE_CN: Record<CameraMove, string> = {
  fixed: "固定机位",
  push: "缓慢推镜",
  pull: "缓慢拉镜",
  pan: "横摇镜头",
  follow: "跟随镜头",
  handheld: "手持跟拍",
};

/** 情绪词 → 氛围标签（命中第一个即采用） */
const MOOD_LEXICON: [RegExp, string][] = [
  [/冷笑|讥讽|嘲讽/, "冷峻对峙"],
  [/怒|咆哮|吼|砸/, "激烈冲突"],
  [/哭|泪|哽咽|抽泣/, "悲伤压抑"],
  [/笑|开心|欣喜/, "轻快明亮"],
  [/惊|瞪大|不敢置信/, "震惊反转"],
  [/阴森|黑影|深夜|角落/, "悬疑紧张"],
  [/温柔|轻声|凝视/, "温情细腻"],
];

/** 动作强度词 → 运镜建议 */
const CAMERA_LEXICON: [RegExp, CameraMove][] = [
  [/冲|跑|追|逃|奔/, "follow"],
  [/逼近|走向|靠近|压过来/, "push"],
  [/环视|扫过|转身看/, "pan"],
  [/打|砸|撕|推搡/, "handheld"],
  [/退|离开|远去|背影/, "pull"],
];

function detectMood(text: string): string {
  for (const [re, mood] of MOOD_LEXICON) if (re.test(text)) return mood;
  return "日常叙事";
}

function detectCamera(text: string, fallback: CameraMove): CameraMove {
  for (const [re, mv] of CAMERA_LEXICON) if (re.test(text)) return mv;
  return fallback;
}

/** 台词时长：中文约 4.5 字/秒，限幅 2-8 秒；画面镜头 3-6 秒 */
function dialogueDuration(text: string): number {
  return Math.min(8, Math.max(2, Math.round(text.length / 4.5)));
}
function actionDuration(text: string): number {
  return Math.min(6, Math.max(3, Math.round(text.length / 15)));
}

function buildAgentPrompt(
  shotType: ShotType,
  cameraMove: CameraMove,
  visual: string,
  mood: string,
  character: string,
): string {
  const who = character ? `${character}，` : "";
  return [
    `竖屏短剧画面，${SHOT_TYPE_CN[shotType]}，${CAMERA_MOVE_CN[cameraMove]}，`,
    `${who}${visual}，${mood}氛围，`,
    "电影感打光，浅景深，高饱和网剧色调，9:16",
  ].join("");
}

/**
 * 拆解剧本为分镜表。
 * 规则：
 * - 场景标记行 → 先插一个远景交代镜头（3s）
 * - 台词行 → 近景/中景对话镜头（情绪激烈时给特写）
 * - 旁白/动作行 → 中景/全景动作镜头；超过 60 字拆两镜
 * - 无场景标记的集 → 开头补一个远景交代镜头
 */
export function breakDownScript(workTitle: string, scriptText: string): Storyboard {
  const parsed = parseScript(scriptText);
  const shots: StoryboardShot[] = [];
  let shotNo = 0;
  let currentScene = "默认场景";
  let scenePendingEstablish = true; // 每个场景开头补远景

  const pushShot = (s: Omit<StoryboardShot, "shotNo" | "agentPrompt">) => {
    shotNo += 1;
    shots.push({
      ...s,
      shotNo,
      agentPrompt: buildAgentPrompt(s.shotType, s.cameraMove, s.visual, s.mood, s.character),
    });
  };

  for (const line of parsed.lines) {
    const text = line.text.trim();
    if (!text || line.kind === "title") continue;

    const sceneMatch = SCENE_RE.exec(text) ?? FOUNTAIN_SCENE_RE.exec(text);
    if (sceneMatch) {
      currentScene = (sceneMatch[2] ?? sceneMatch[1]).trim();
      pushShot({
        episodeNo: line.episodeNo,
        scene: currentScene,
        character: "",
        shotType: "long",
        cameraMove: "fixed",
        visual: `场景全貌：${currentScene}`,
        dialogue: "",
        durationSec: 3,
        mood: detectMood(currentScene),
      });
      scenePendingEstablish = false;
      continue;
    }

    if (scenePendingEstablish) {
      pushShot({
        episodeNo: line.episodeNo,
        scene: currentScene,
        character: "",
        shotType: "long",
        cameraMove: "fixed",
        visual: `场景全貌：${currentScene}`,
        dialogue: "",
        durationSec: 3,
        mood: "日常叙事",
      });
      scenePendingEstablish = false;
    }

    const dlg = line.kind === "dialogue" ? DIALOGUE_RE.exec(text) : null;
    if (dlg) {
      const character = dlg[1];
      const emotion = dlg[2] ?? "";
      const utterance = dlg[3].trim();
      const intense = /怒|吼|咆哮|哭|惊|冷笑/.test(emotion + utterance);
      pushShot({
        episodeNo: line.episodeNo,
        scene: currentScene,
        character,
        shotType: intense ? "extreme_close" : utterance.length > 25 ? "medium" : "close",
        cameraMove: detectCamera(utterance, "fixed"),
        visual: `${character}${emotion ? `（${emotion}）` : ""}说台词`,
        dialogue: utterance,
        durationSec: dialogueDuration(utterance),
        mood: detectMood(emotion + utterance),
      });
      continue;
    }

    // 旁白/动作行：超长拆两镜
    const chunks: string[] = [];
    if (text.length > 60) {
      const mid = Math.ceil(text.length / 2);
      chunks.push(text.slice(0, mid), text.slice(mid));
    } else {
      chunks.push(text);
    }
    for (const chunk of chunks) {
      pushShot({
        episodeNo: line.episodeNo,
        scene: currentScene,
        character: "",
        shotType: chunk.length > 30 ? "full" : "medium",
        cameraMove: detectCamera(chunk, "fixed"),
        visual: chunk,
        dialogue: "",
        durationSec: actionDuration(chunk),
        mood: detectMood(chunk),
      });
    }
  }

  const totalDurationSec = shots.reduce((s, x) => s + x.durationSec, 0);
  return {
    workTitle,
    episodeCount: parsed.episodeCount,
    shotCount: shots.length,
    totalDurationSec,
    shots,
    engineVersion: STORYBOARD_ENGINE_VERSION,
  };
}

/** 导出 CSV（人工分镜表） */
export function storyboardToCsv(sb: Storyboard): string {
  const header = "镜号,集,场景,角色,景别,运镜,画面内容,台词,时长(秒),情绪,Agent提示词";
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = sb.shots.map((s) =>
    [
      s.shotNo, s.episodeNo, s.scene, s.character, SHOT_TYPE_CN[s.shotType],
      CAMERA_MOVE_CN[s.cameraMove], s.visual, s.dialogue, s.durationSec, s.mood, s.agentPrompt,
    ].map(esc).join(","),
  );
  return "﻿" + [header, ...rows].join("\n");
}

/** 导出 Prompt Pack（逐镜提示词清单，供批量投喂视频生成 agent） */
export function storyboardToPromptPack(sb: Storyboard): string {
  const lines: string[] = [
    `# 《${sb.workTitle}》分镜提示词包`,
    `# 共 ${sb.shotCount} 镜 ｜ 估算总时长 ${Math.round(sb.totalDurationSec / 60)} 分钟 ｜ 引擎 ${sb.engineVersion}`,
    "",
  ];
  for (const s of sb.shots) {
    lines.push(`## 镜${s.shotNo}（第${s.episodeNo}集 · ${s.scene} · ${SHOT_TYPE_CN[s.shotType]} · ${s.durationSec}s）`);
    lines.push(s.agentPrompt);
    if (s.dialogue) lines.push(`台词：${s.character ? `${s.character}：` : ""}${s.dialogue}`);
    lines.push("");
  }
  return lines.join("\n");
}
