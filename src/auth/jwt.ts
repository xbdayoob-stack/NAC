import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import type { StaffRole } from "../types/order.js";

const ACCESS_TTL_SEC = 15 * 60;
const REFRESH_TTL_SEC = 7 * 24 * 60 * 60;

export interface StaffAccessClaims {
  sub: string;
  shopId: string;
  role: StaffRole;
  type: "access";
}

export interface StaffRefreshClaims {
  sub: string;
  jti: string;
  type: "refresh";
}

function accessSecret(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  secret: string,
  claims: Omit<StaffAccessClaims, "type">,
): Promise<string> {
  return new SignJWT({ ...claims, type: "access" as const })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(accessSecret(secret));
}

export async function verifyAccessToken(
  secret: string,
  token: string,
): Promise<StaffAccessClaims> {
  const { payload } = await jwtVerify(token, accessSecret(secret));
  if (payload.type !== "access" || typeof payload.sub !== "string") {
    throw new Error("Invalid access token");
  }
  return payload as unknown as StaffAccessClaims;
}

export async function signRefreshToken(
  secret: string,
  userId: string,
  jti: string,
): Promise<string> {
  return new SignJWT({ sub: userId, jti, type: "refresh" as const })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TTL_SEC}s`)
    .sign(accessSecret(secret));
}

export async function verifyRefreshToken(
  secret: string,
  token: string,
): Promise<StaffRefreshClaims> {
  const { payload } = await jwtVerify(token, accessSecret(secret));
  if (
    payload.type !== "refresh" ||
    typeof payload.sub !== "string" ||
    typeof payload.jti !== "string"
  ) {
    throw new Error("Invalid refresh token");
  }
  return payload as unknown as StaffRefreshClaims;
}

export function newRefreshJti(): string {
  return randomBytes(16).toString("hex");
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export { ACCESS_TTL_SEC, REFRESH_TTL_SEC };
