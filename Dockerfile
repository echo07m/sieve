# ── 构建阶段 ──────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# 先复制依赖清单，利用 Docker 层缓存
COPY package.json package-lock.json ./
RUN npm ci

# 复制源码并构建（前端 Vite 构建 + 后端 esbuild 打包至 dist/）
COPY . .
RUN npm run build

# ── 运行时阶段 ────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# 仅安装生产依赖
COPY package.json package-lock.json ./
RUN npm ci --omit=production

# 从构建阶段复制产物（db/migrations 供启动时自动建表使用）
COPY --from=builder /app/dist ./dist
COPY db/migrations ./db/migrations

# 运行时配置（DATABASE_URL、APP_ID、APP_SECRET、KIMI_AUTH_URL 等）
# 不打包进镜像，请通过 docker run -e 或 docker-compose 的 environment 注入，
# 参考 .env.example 中的变量清单。
EXPOSE 3000
CMD ["npm", "start"]
