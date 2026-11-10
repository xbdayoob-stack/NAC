import { z } from "zod";
import type { PosAdapter, PosWebhookPayload } from "./types.js";

const schema = z.object({
  externalId: z.string(),
  shopSlug: z.string().optional(),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number().int().positive(),
      modifiers: z.array(z.string()).optional(),
    }),
  ),
  status: z.string().optional(),
});

export const genericPosAdapter: PosAdapter = {
  name: "generic",
  parse(body: unknown): PosWebhookPayload {
    return schema.parse(body);
  },
};
