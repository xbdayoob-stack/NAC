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
RUN npm ci --omit=dev
RUN npm rebuild better-sqlite3
RUN node -e "const Database=require('better-sqlite3'); const fs=require('fs'); const p='/tmp/nac-build-test.db'; try{fs.unlinkSync(p);}catch(e){} const db=new Database(p); db.pragma('journal_mode=DELETE'); db.close(); fs.unlinkSync(p); console.log('better-sqlite3 native ok');"
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/schemas ./schemas
COPY --from=build /app/public ./public
RUN mkdir -p /app/data
ENV SQLITE_PATH=/app/data/app.db
EXPOSE 8080
CMD ["node", "dist/index.js"]
