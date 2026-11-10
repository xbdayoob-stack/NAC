# Coffee shop order-queue backend

Fastify + TypeScript + SQLite backend for customer order tracking via **Live Activities** (APNs), **SSE**, and a **mobile web fallback**.

## Quick start

```bash
npm install
cp .env.example .env
npm run seed
npm run dev
```

- Health: `GET /health`
- Ready: `GET /ready`
- Demo staff: `barista@demo.local` / `password123`
- Staff test UI (login + QR): [http://localhost:3000/staff](http://localhost:3000/staff)

## iOS Live Activity contract

Swift `ContentState` must match [`schemas/live-activity-content-state.json`](schemas/live-activity-content-state.json) (`status`, `etaMinutes`, `updatedAt`).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | API + job worker (hot reload) |
| `npm test` | Vitest unit + integration + API tests |
| `npm run push:test -- <token>` | Send sandbox Live Activity update |
| `npm run seed` | Demo shop + staff user |

## Docker

```bash
docker compose up --build
```

SQLite file persists in `./data`.

## Architecture notes

- Single-instance deployment (SQLite + in-memory SSE hub).
- Status changes enqueue `notify.order_status` jobs; APNs never blocks staff PATCH.
- Secrets validated at boot via Zod (`src/config/env.ts`).

## APNs setup

1. Create an APNs `.p8` key in Apple Developer.
2. Set `APNS_KEY_P8`, `APNS_KEY_ID`, `APNS_TEAM_ID`, and bundle IDs.
3. Register device Live Activity push token: `POST /v1/orders/:orderId/push-token`.
