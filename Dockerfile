# 生产环境 Dockerfile
FROM node:20-alpine

WORKDIR /app

# 复制后端代码
COPY backend/package*.json ./
RUN npm ci --only=production

COPY backend/ ./

# 复制前端静态文件
COPY index.html style.css script.js ./
COPY admin.html admin.css admin.js ./

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/data || exit 1

# 启动
CMD ["node", "server.js"]
