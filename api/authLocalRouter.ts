/**
 * 本地账号认证：用户名/邮箱 + 密码注册登录。
 * 与 Kimi OAuth 共用同一 session JWT（cookie kimi_sid），登录后身份完全等价。
 * 密码使用 Node 内置 scrypt 加盐哈希存储，格式 scrypt$N$r$p$salt$hash。
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import * as cookie from "cookie";
import { TRPCError } from "@trpc/server";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { authProviders, users } from "@db/schema";
import { Session } from "@contracts/constants";
import { env } from "./lib/env";
import { getSessionCookieOptions } from "./lib/cookies";
import { adminQuery, authedQuery, createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { signSessionToken } from "./kimi/session";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 64;

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }).toString("hex");
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, salt, hash] = parts;
  const calc = scryptSync(plain, salt, KEYLEN, { N: +n, r: +r, p: +p });
  const expect = Buffer.from(hash, "hex");
  return calc.length === expect.length && timingSafeEqual(calc, expect);
}

type CookieCtx = { resHeaders: Headers; req: { headers: Headers } };

async function issueSession(ctx: CookieCtx, unionId: string) {
  const token = await signSessionToken({ unionId, clientId: env.appId });
  const opts = getSessionCookieOptions(ctx.req.headers);
  ctx.resHeaders.append(
    "set-cookie",
    cookie.serialize(Session.cookieName, token, {
      httpOnly: opts.httpOnly,
      path: opts.path,
      sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
      secure: opts.secure,
      maxAge: Session.maxAgeMs / 1000,
    }),
  );
}

const usernameSchema = z
  .string()
  .min(3, "用户名至少 3 位")
  .max(32, "用户名最多 32 位")
  .regex(/^[\w一-龥-]+$/, "用户名仅支持中英文、数字、下划线、连字符");

const passwordSchema = z.string().min(8, "密码至少 8 位").max(72, "密码最多 72 位");

export const authLocalRouter = createRouter({
  /** 注册：用户名 + 密码（邮箱可选，用于找回与团队邀请匹配） */
  register: publicQuery
    .input(
      z.object({
        username: usernameSchema,
        password: passwordSchema,
        email: z.string().email("邮箱格式不正确").max(320).optional().or(z.literal("")),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [dupName] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, input.username));
      if (dupName) {
        throw new TRPCError({ code: "CONFLICT", message: "该用户名已被注册" });
      }
      if (input.email) {
        const [dupMail] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, input.email));
        if (dupMail) {
          throw new TRPCError({ code: "CONFLICT", message: "该邮箱已被注册" });
        }
      }
      await db.insert(users).values({
        unionId: `pwd_${input.username}`,
        name: input.username,
        username: input.username,
        email: input.email || null,
        passwordHash: hashPassword(input.password),
        lastSignInAt: new Date(),
      });
      await issueSession(ctx, `pwd_${input.username}`);
      return { ok: true };
    }),

  /** 登录：用户名或邮箱 + 密码 */
  login: publicQuery
    .input(
      z.object({
        identifier: z.string().min(1, "请输入用户名或邮箱").max(320),
        password: z.string().min(1, "请输入密码").max(72),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const id = input.identifier.trim();
      const [user] = await db
        .select()
        .from(users)
        .where(or(eq(users.username, id), eq(users.email, id)))
        .limit(1);
      // 统一报错文案，避免枚举账号
      if (!user || !user.passwordHash || !verifyPassword(input.password, user.passwordHash)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "用户名/邮箱或密码错误" });
      }
      await db.update(users).set({ lastSignInAt: new Date() }).where(eq(users.id, user.id));
      await issueSession(ctx, user.unionId);
      return { ok: true, name: user.name };
    }),

  /** 当前账号是否已设置密码 / 绑定 GitHub（账号安全页用） */
  myAuthMethods: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const [u] = await db
      .select({
        username: users.username,
        email: users.email,
        passwordHash: users.passwordHash,
        githubId: users.githubId,
      })
      .from(users)
      .where(eq(users.id, ctx.user.id));
    return {
      username: u?.username ?? null,
      email: u?.email ?? null,
      hasPassword: Boolean(u?.passwordHash),
      githubBound: Boolean(u?.githubId),
    };
  }),

  /** 为当前账号设置/修改密码（Kimi/GitHub 注册用户可补设密码） */
  setPassword: authedQuery
    .input(
      z.object({
        password: passwordSchema,
        username: usernameSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const patch: Partial<typeof users.$inferInsert> = {
        passwordHash: hashPassword(input.password),
      };
      if (input.username) {
        const [dup] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.username, input.username));
        if (dup && dup.id !== ctx.user.id) {
          throw new TRPCError({ code: "CONFLICT", message: "该用户名已被占用" });
        }
        patch.username = input.username;
      }
      await db.update(users).set(patch).where(eq(users.id, ctx.user.id));
      return { ok: true };
    }),

  /** 已启用的第三方登录提供方（登录页用，不含密钥） */
  enabledProviders: publicQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({ provider: authProviders.provider })
      .from(authProviders)
      .where(eq(authProviders.enabled, true));
    return rows.map((r) => r.provider);
  }),

  // ---------- 管理员：第三方登录配置 ----------

  getProviders: adminQuery.query(async () => {
    const db = getDb();
    const rows = await db.select().from(authProviders);
    return rows.map((r) => ({
      provider: r.provider,
      clientId: r.clientId,
      hasSecret: Boolean(r.clientSecret),
      enabled: r.enabled,
      updatedAt: r.updatedAt,
    }));
  }),

  upsertProvider: adminQuery
    .input(
      z.object({
        provider: z.enum(["github"]),
        clientId: z.string().max(128),
        clientSecret: z.string().max(128).optional(), // 不传则保留原密钥
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [exist] = await db
        .select()
        .from(authProviders)
        .where(eq(authProviders.provider, input.provider));
      if (exist) {
        await db
          .update(authProviders)
          .set({
            clientId: input.clientId,
            ...(input.clientSecret ? { clientSecret: input.clientSecret } : {}),
            enabled: input.enabled,
          })
          .where(eq(authProviders.provider, input.provider));
      } else {
        await db.insert(authProviders).values({
          provider: input.provider,
          clientId: input.clientId,
          clientSecret: input.clientSecret ?? "",
          enabled: input.enabled,
        });
      }
      return { ok: true };
    }),
});
