import type { FastifyReply, FastifyRequest } from "fastify";

interface Bucket {
  count: number;
  resetAt: number;
}

const ipBuckets = new Map<string, Bucket>();
const orderBuckets = new Map<string, Bucket>();

function checkBucket(
  map: Map<string, Bucket>,
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  let b = map.get(key);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    map.set(key, b);
  }
  b.count += 1;
  return b.count <= limit;
}

export function rateLimitByIp(limit = 60, windowMs = 60_000) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const ip = request.ip;
    if (!checkBucket(ipBuckets, ip, limit, windowMs)) {
      return reply.status(429).send({ error: "Too many requests" });
    }
  };
}

export function rateLimitByOrderId(limit = 30, windowMs = 60_000) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { orderId?: string };
    if (!params.orderId) return;
    if (!checkBucket(orderBuckets, params.orderId, limit, windowMs)) {
      return reply.status(429).send({ error: "Too many requests" });
    }
  };
}

export function rateLimitLogin(limit = 10, windowMs = 60_000) {
  return rateLimitByIp(limit, windowMs);
}

export function clearRateLimitState(): void {
  ipBuckets.clear();
  orderBuckets.clear();
}
