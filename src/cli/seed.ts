import "../bootstrap-crypto.js";
import { loadEnv } from "../config/env.js";
import { createDatabase, runMigrations } from "../db/client.js";
import { seedDemoShop } from "../db/seed.js";

async function main() {
  const env = loadEnv();
  const { sqlite, db } = createDatabase(env.SQLITE_PATH);
  runMigrations(sqlite);
  const seed = await seedDemoShop(db);
  console.log("Seeded demo shop:", seed);
  sqlite.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
