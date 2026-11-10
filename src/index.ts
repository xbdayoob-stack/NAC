import "./bootstrap-crypto.js";
import { loadEnv } from "./config/env.js";
import { buildApp } from "./app.js";

async function main() {
  console.log("[nac] booting");
  const env = loadEnv();
  console.log(
    `[nac] env ok; PORT=${env.PORT} NODE_ENV=${env.NODE_ENV} SQLITE_PATH=${env.SQLITE_PATH}`,
  );
  console.log("[nac] building app (db migrate + routes)…");
  const { app } = await buildApp({ env, enableWorker: true, migrate: true });
  console.log(`[nac] listening on 0.0.0.0:${env.PORT}…`);
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  console.log(`[nac] ready http://0.0.0.0:${env.PORT}`);
}

main().catch((err) => {
  console.error("[nac] fatal boot error:", err);
  process.exit(1);
});
