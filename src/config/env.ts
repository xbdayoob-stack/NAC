import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  SQLITE_PATH: z.string().min(1).default("./data/app.db"),
  PUBLIC_BASE_URL: z.string().url().default("http://localhost:3000"),
  JWT_SECRET: z.string().min(16).default("dev-jwt-secret-change-me!!"),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16)
    .default("dev-refresh-secret-change!!"),
  ORDER_EXPIRY_HOURS: z.coerce.number().positive().default(24),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  APPLE_TEAM_ID: z.string().optional(),
  MAIN_BUNDLE_ID: z.string().optional(),
  APP_CLIP_BUNDLE_ID: z.string().optional(),
  APNS_KEY_P8: z.string().optional(),
  APNS_KEY_ID: z.string().optional(),
  APNS_TEAM_ID: z.string().optional(),
  DEFAULT_APNS_BUNDLE_ID: z.string().optional(),
  POS_WEBHOOK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function loadEnv(overrides?: Partial<Env>): Env {
  if (cached && !overrides) return cached;
  const parsed = envSchema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.message}`);
  }
  if (!overrides) cached = parsed.data;
  return parsed.data;
}

export function getCorsOrigins(env: Env): string[] {
  return env.CORS_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function apnsConfigured(env: Env): boolean {
  return Boolean(env.APNS_KEY_P8 && env.APNS_KEY_ID && env.APNS_TEAM_ID);
}

