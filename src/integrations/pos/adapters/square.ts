import { genericPosAdapter } from "./generic.js";
import type { PosAdapter } from "./types.js";

/** Square webhook normalization — extend field mapping as needed. */
export const squarePosAdapter: PosAdapter = {
  name: "square",
  parse: genericPosAdapter.parse,
};
