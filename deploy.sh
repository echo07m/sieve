#!/usr/bin/env bash
# 剧合规一键部署（docker compose）
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] || { cp .env.example .env; echo "已生成 .env，请先编辑填写 APP_ID/APP_SECRET/DB_ROOT_PASSWORD 后重跑"; exit 1; }
docker compose up -d --build
echo "部署完成：http://localhost:${APP_PORT:-3000}"
