FROM node:20-bookworm
RUN apt-get update \
    && apt-get install -y python3 make g++ build-essential \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Railway injects NODE_ENV=production at build time; devDeps are required for `tsc`.
ENV NPM_CONFIG_PRODUCTION=false
COPY package*.json .npmrc ./
RUN npm ci --include=dev \
    && rm -rf node_modules/better-sqlite3/prebuilds \
    && npm rebuild better-sqlite3 --foreground-scripts
COPY . .
RUN npm run build && npm prune --omit=dev
ENV NODE_ENV=production
ENV SQLITE_PATH=/app/data/app.db
RUN mkdir -p /app/data \
    && node -e "require('better-sqlite3')(':memory:').close(); console.log('better-sqlite3 native ok');"
EXPOSE 8080
CMD ["node", "dist/index.js"]
