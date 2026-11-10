# Single-stage: one npm install so better-sqlite3 is compiled once for this image
# (multi-stage runtime re-installs prebuilds that segfault on Railway).
FROM node:20-bookworm
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV npm_config_build_from_source=true
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build \
    && npm prune --omit=dev \
    && node -e "require('better-sqlite3')(':memory:').close(); console.log('better-sqlite3 native ok');"
RUN mkdir -p /app/data
ENV SQLITE_PATH=/app/data/app.db
EXPOSE 8080
CMD ["node", "dist/index.js"]
