# Node 18 + better-sqlite3 prebuilds: Node 20 native loads segfault on Railway builders.
FROM node:18-bookworm
RUN apt-get update \
    && apt-get install -y python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NPM_CONFIG_PRODUCTION=false
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV SQLITE_PATH=/app/data/app.db
RUN mkdir -p /app/data
EXPOSE 8080
CMD ["node", "dist/index.js"]
