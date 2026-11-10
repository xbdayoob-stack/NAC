import { genericPosAdapter } from "./generic.js";
import type { PosAdapter } from "./types.js";

export const shopifyPosAdapter: PosAdapter = {
  name: "shopify",
  parse: genericPosAdapter.parse,
};
