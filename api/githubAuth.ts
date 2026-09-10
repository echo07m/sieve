/**
 * GitHub OAuth 登录。
 * 配置存于 auth_providers 表（管理员后台配置 Client ID/Secret），无需改环境变量。
 * 流程：GET /api/auth/github → 302 到 GitHub 授权页 → 回调 /api/auth/github/callback
 * → 换 token → 取用户资料 → upsert（unionId = gh_<id>，并按 githubId 列绑定既有账号）
 * → 签发与 Kimi 登录完全相同的 session cookie → 302 回首页。
 */
import { randomBytes } from "node:crypto";
import type { Context, Hono } from "hono";
import { setCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { authProviders, users } from "@db/schema";
import { Session } from "@contracts/constants";
import { env } from "./lib/env";
import { getSessionCookieOptions } from "./lib/cookies";
import { signSessionToken } from "./kimi/session";
import { upsertUser } from "./queries/users";
import { getDb } from "./queries/connection";

/** state 防 CSRF：内存暂存 10 分钟（单实例部署口径） */
const pendingStates = new Map<string, number>();
const STATE_TTL_MS = 10 * 60_000;

function rememberState(s: string) {
  const now = Date.now();
  for (const [k, t] of pendingStates) if (now - t > STATE_TTL_MS) pendingStates.delete(k);
  pendingStates.set(s, now);
}

async function getGithubConfig() {
  const db = getDb();
  const [row] = await db
    .select()
    .from(authProviders)
    .where(eq(authProviders.provider, "github"));
  if (!row || !row.enabled || !row.clientId || !row.clientSecret) return null;
  return row;
}

interface GithubProfile {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  email: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerGithubAuthRoutes(app: Hono<any>): void {
  app.get("/api/auth/github", async (c) => {
    const cfg = await getGithubConfig();
    if (!cfg) return c.json({ error: "GitHub 登录未启用，请联系管理员配置" }, 404);
    const state = randomBytes(16).toString("hex");
    rememberState(state);
    const redirectUri = `${new URL(c.req.url).origin}/api/auth/github/callback`;
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", cfg.clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "read:user user:email");
    url.searchParams.set("state", state);
    return c.redirect(url.toString(), 302);
  });

  app.get("/api/auth/github/callback", async (c: Context) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    if (!code || !state || !pendingStates.delete(state)) {
      return c.json({ error: "非法的登录回跳（code/state 校验失败）" }, 400);
    }
    const cfg = await getGithubConfig();
    if (!cfg) return c.json({ error: "GitHub 登录未启用" }, 404);

    try {
      const redirectUri = `${new URL(c.req.url).origin}/api/auth/github/callback`;
      // 1. code → access_token
      const tokenResp = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          redirect_uri: redirectUri,
        }).toString(),
        signal: AbortSignal.timeout(15_000),
      });
      const tokenData = (await tokenResp.json()) as { access_token?: string; error?: string };
      if (!tokenData.access_token) throw new Error(`token exchange failed: ${tokenData.error ?? tokenResp.status}`);

      // 2. 用户资料（email 可能需单独取）
      const headers = { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/vnd.github+json" };
      const profileResp = await fetch("https://api.github.com/user", { headers, signal: AbortSignal.timeout(15_000) });
      const profile = (await profileResp.json()) as GithubProfile;
      if (!profile.id) throw new Error("failed to fetch github profile");
      let email = profile.email;
      if (!email) {
        const emailsResp = await fetch("https://api.github.com/user/emails", { headers, signal: AbortSignal.timeout(15_000) });
        const emails = (await emailsResp.json()) as { email: string; primary: boolean; verified: boolean }[];
        email = emails.find((e) => e.primary && e.verified)?.email ?? emails[0]?.email ?? null;
      }

      // 3. 建档/更新：优先按 githubId 绑定既有账号，其次按 unionId
      const db = getDb();
      const githubId = String(profile.id);
      const unionId = `gh_${githubId}`;
      const [byGithubId] = await db.select().from(users).where(eq(users.githubId, githubId)).limit(1);
      if (byGithubId) {
        await db
          .update(users)
          .set({
            name: profile.name ?? profile.login,
            avatar: profile.avatar_url,
            email: email ?? byGithubId.email,
            lastSignInAt: new Date(),
          })
          .where(eq(users.id, byGithubId.id));
        const token = await signSessionToken({ unionId: byGithubId.unionId, clientId: env.appId });
        const cookieOpts = getSessionCookieOptions(c.req.raw.headers);
        setCookie(c, Session.cookieName, token, { ...cookieOpts, maxAge: Session.maxAgeMs / 1000 });
        return c.redirect("/", 302);
      }
      await upsertUser({
        unionId,
        name: profile.name ?? profile.login,
        email,
        avatar: profile.avatar_url,
        githubId,
        lastSignInAt: new Date(),
      });

      // 4. 签发 session（与 Kimi 登录同一 cookie）
      const token = await signSessionToken({ unionId, clientId: env.appId });
      const cookieOpts = getSessionCookieOptions(c.req.raw.headers);
      setCookie(c, Session.cookieName, token, { ...cookieOpts, maxAge: Session.maxAgeMs / 1000 });
      return c.redirect("/", 302);
    } catch (e) {
      console.error("[GitHub OAuth] callback failed:", e);
      return c.json({ error: "GitHub 登录失败，请重试" }, 500);
    }
  });
}
