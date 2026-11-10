FROM node:20-bookworm-slim AS build
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# Prebuilt better-sqlite3 binaries often segfault on Railway; compile for this image.
ENV npm_config_build_from_source=true
RUN npm ci --omit=dev \
    && rm -rf node_modules/better-sqlite3/prebuilds \
    && npm rebuild better-sqlite3 \
    && node -e "require('better-sqlite3')(':memory:').close(); console.log('better-sqlite3 native ok');"
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/schemas ./schemas
COPY --from=build /app/public ./public
RUN mkdir -p /app/data
ENV SQLITE_PATH=/app/data/app.db
EXPOSE 8080
CMD ["node", "dist/index.js"]
