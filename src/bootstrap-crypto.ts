import { webcrypto } from "node:crypto";

/** nanoid v6 expects globalThis.crypto (Node 18 without --experimental-global-webcrypto). */
if (typeof globalThis.crypto === "undefined") {
  (
    globalThis as typeof globalThis & { crypto: Crypto }
  ).crypto = webcrypto as unknown as Crypto;
}
