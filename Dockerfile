# 独立项目：只要 Node 18+
# 注意：安装依赖这一步不能省，否则 DATABASE_URL 模式下 import('pg') 会失败
FROM node:22-alpine
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY server.mjs ./
COPY public ./public

ENV NODE_ENV=production
EXPOSE 10000
CMD ["node", "server.mjs"]
