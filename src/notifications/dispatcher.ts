import type { FastifyBaseLogger } from "fastify";
import type { NotificationChannel } from "./channel.js";

export class NotificationDispatcher {
  constructor(
    private readonly channels: NotificationChannel[],
    private readonly log: FastifyBaseLogger,
  ) {}

  async fanOut(
    ctx: Parameters<NotificationChannel["send"]>[0],
  ): Promise<void> {
    for (const channel of this.channels) {
      const start = Date.now();
      const result = await channel.send(ctx);
      const latency = Date.now() - start;
      if (result.ok) {
        this.log.info(
          { channel: channel.name, orderId: ctx.order.id, push_latency_ms: latency },
          "push_success",
        );
      } else {
        this.log.warn(
          {
            channel: channel.name,
            orderId: ctx.order.id,
            push_latency_ms: latency,
            push_failure_reason: result.errorCode ?? result.errorMessage,
          },
          "push_failure",
        );
        throw new Error(
          `${channel.name}: ${result.errorMessage ?? result.errorCode}`,
        );
      }
    }
  }
}
