import { importPKCS8, SignJWT } from "jose";
import type { Env } from "../config/env.js";

const CACHE_MS = 40 * 60 * 1000;

interface CachedJwt {
  token: string;
  expiresAt: number;
}

let cache: CachedJwt | null = null;
let refreshPromise: Promise<string> | null = null;
let keyMaterial: CryptoKey | null = null;

async function getKey(p8: string): Promise<CryptoKey> {
  if (keyMaterial) return keyMaterial;
  const pem = p8.includes("BEGIN PRIVATE KEY")
    ? p8
    : `-----BEGIN PRIVATE KEY-----\n${p8}\n-----END PRIVATE KEY-----`;
  keyMaterial = await importPKCS8(pem, "ES256");
  return keyMaterial;
}

async function generateToken(env: Env): Promise<string> {
  if (!env.APNS_KEY_P8 || !env.APNS_KEY_ID || !env.APNS_TEAM_ID) {
    throw new Error("APNs credentials not configured");
  }
  const key = await getKey(env.APNS_KEY_P8);
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: env.APNS_KEY_ID })
    .setIssuer(env.APNS_TEAM_ID)
    .setIssuedAt(now)
    .sign(key);
  cache = { token, expiresAt: Date.now() + CACHE_MS };
  return token;
}

export async function getApnsJwt(env: Env, force = false): Promise<string> {
  if (!force && cache && Date.now() < cache.expiresAt) {
    return cache.token;
  }
  if (!refreshPromise) {
    refreshPromise = generateToken(env).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export function clearApnsJwtCache(): void {
  cache = null;
}
