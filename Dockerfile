FROM node:20-bookworm
RUN apt-get update \
    && apt-get install -y python3 make g++ build-essential \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# Railway injects NODE_ENV=production at build time; devDeps are required for `tsc`.
ENV NPM_CONFIG_PRODUCTION=false
COPY package*.json .npmrc ./
RUN npm ci --include=dev
COPY . .
RUN npm run build && npm prune --omit=dev
# Compile better-sqlite3 after prune so the .node binding is not stripped; drop broken prebuilds.
RUN rm -rf node_modules/better-sqlite3/prebuilds \
    && npm rebuild better-sqlite3 --foreground-scripts \
    && node -e "const fs=require('fs');const p='node_modules/better-sqlite3/build/Release/better_sqlite3.node';if(!fs.existsSync(p)) throw new Error('missing '+p); require('better-sqlite3')(':memory:').close(); console.log('better-sqlite3 native ok');"
ENV NODE_ENV=production
ENV SQLITE_PATH=/app/data/app.db
RUN mkdir -p /app/data
EXPOSE 8080
CMD ["node", "dist/index.js"]
