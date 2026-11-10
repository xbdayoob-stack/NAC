import { loadEnv } from "./config/env.js";
import { buildApp } from "./app.js";

async function main() {
  console.log("[nac] booting");
  const env = loadEnv();
  console.log(`[nac] env ok; PORT=${env.PORT} NODE_ENV=${env.NODE_ENV}`);
  const { app } = await buildApp({ env, enableWorker: true, migrate: true });
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
