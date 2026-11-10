import http2 from "node:http2";
import type { Env } from "../config/env.js";
import { getApnsJwt, clearApnsJwtCache } from "./jwt.js";
import type { ApnsSendResult } from "./types.js";
import type { ApnsEnvironment } from "../types/order.js";

const HOSTS: Record<ApnsEnvironment, string> = {
  sandbox: "api.sandbox.push.apple.com",
  production: "api.push.apple.com",
};

class ApnsConnection {
  private session: http2.ClientHttp2Session | null = null;
  private connecting: Promise<void> | null = null;

  constructor(
    private readonly host: string,
    private readonly env: Env,
  ) {}

  private async ensureSession(): Promise<http2.ClientHttp2Session> {
    if (this.session && !this.session.closed && !this.session.destroyed) {
      return this.session;
    }
    if (!this.connecting) {
      this.connecting = new Promise((resolve, reject) => {
        const session = http2.connect(`https://${this.host}:443`);
        session.on("error", reject);
        session.once("connect", () => {
          this.session = session;
          this.connecting = null;
          resolve();
        });
      });
    }
    await this.connecting;
    if (!this.session) throw new Error("APNs session missing");
    return this.session;
  }

  async send(params: {
    token: string;
    topic: string;
    priority: number;
    expiration: number;
    payload: string;
    retryOn403?: boolean;
  }): Promise<ApnsSendResult> {
    const jwt = await getApnsJwt(this.env);
    const session = await this.ensureSession();

    return new Promise<ApnsSendResult>((resolve, reject) => {
      const req = session.request({
        ":method": "POST",
        ":path": `/3/device/${params.token}`,
        authorization: `bearer ${jwt}`,
        "apns-push-type": "liveactivity",
        "apns-topic": `${params.topic}.push-type.liveactivity`,
        "apns-priority": String(params.priority),
        "apns-expiration": String(params.expiration),
      });

      req.on("error", reject);

      req.on("response", (headers) => {
        const statusCode = headers[":status"] as number;
        let data = "";
        req.on("data", (c) => {
          data += c;
        });
        req.on("end", () => {
          let reason: string | undefined;
          if (data) {
            try {
              reason = (JSON.parse(data) as { reason?: string }).reason;
            } catch {
              reason = data;
            }
          }
          const result: ApnsSendResult = {
            statusCode,
            apnsId: headers["apns-id"] as string | undefined,
            reason,
          };

          if (statusCode === 403 && reason === "ExpiredProviderToken" && params.retryOn403 !== false) {
            clearApnsJwtCache();
            void this.send({ ...params, retryOn403: false }).then(resolve).catch(reject);
            return;
          }
          resolve(result);
        });
      });

      req.write(params.payload);
      req.end();
    });
  }

  close(): void {
    this.session?.close();
    this.session = null;
  }
}

export class ApnsClient {
  private readonly pools = new Map<ApnsEnvironment, ApnsConnection>();

  constructor(private readonly env: Env) {}

  private pool(environment: ApnsEnvironment): ApnsConnection {
    let conn = this.pools.get(environment);
    if (!conn) {
      conn = new ApnsConnection(HOSTS[environment], this.env);
      this.pools.set(environment, conn);
    }
    return conn;
  }

  async sendLiveActivity(
    environment: ApnsEnvironment,
    input: {
      token: string;
      topicBundleId: string;
      priority: number;
      expirationSec: number;
      payloadJson: string;
    },
  ): Promise<ApnsSendResult> {
    return this.pool(environment).send({
      token: input.token,
      topic: input.topicBundleId,
      priority: input.priority,
      expiration: input.expirationSec,
      payload: input.payloadJson,
    });
  }

  closeAll(): void {
    for (const c of this.pools.values()) c.close();
    this.pools.clear();
  }
}

export function isInvalidDeviceToken(result: ApnsSendResult): boolean {
  if (result.statusCode === 410) return true;
  const r = result.reason?.toLowerCase() ?? "";
  return r.includes("baddevicetoken") || r.includes("unregistered");
}

export function isRetryable(result: ApnsSendResult): boolean {
  return result.statusCode === 429 || result.statusCode >= 500;
}
