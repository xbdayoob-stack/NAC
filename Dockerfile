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
RUN npm run build \
    && rm -rf node_modules/better-sqlite3/prebuilds \
    && sh -c 'cd node_modules/better-sqlite3 && npx --yes node-gyp rebuild --release' \
    && test -f node_modules/better-sqlite3/build/Release/better_sqlite3.node \
    && node -e "require('better-sqlite3')(':memory:').close(); console.log('better-sqlite3 native ok');"
# Skip `npm prune` — it removed better-sqlite3's compiled binding on Railway.
ENV NODE_ENV=production
ENV SQLITE_PATH=/app/data/app.db
RUN mkdir -p /app/data
EXPOSE 8080
CMD ["node", "dist/index.js"]
