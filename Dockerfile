# 独立项目：只要 Node 18+
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server.mjs ./
COPY public ./public
ENV PORT=8787 NODE_ENV=production
EXPOSE 8787
VOLUME ["/app/data"]
CMD ["node", "server.mjs"]
