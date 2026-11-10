import { genericPosAdapter } from "./generic.js";
import type { PosAdapter } from "./types.js";

export const toastPosAdapter: PosAdapter = {
  name: "toast",
  parse: genericPosAdapter.parse,
};
