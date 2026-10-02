import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { migrate } from "./db/migrate.js";
import { createPool } from "./db/pool.js";
import { isSeeded, seed } from "./crm/seed.js";
import { openDb as openRolodexDb } from "./rolodex/db/index.js";
import { seedIfEmpty as seedRolodex } from "./rolodex/seed.js";
import { seedIfEmpty as seedSpace } from "./space/seed.js";
import { createApp } from "./app.js";
import { seed as seedAuth } from "./auth/db.js";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
loadEnv({ path: path.join(root, ".env") });

const dataDir = path.resolve(root, process.env.DATA_DIR ?? "data");
const port = Number(process.env.PORT ?? 8100);

const databaseUrl = process.env.DATABASE_URL;
const jwtSecret = process.env.JWT_SECRET;
if (!databaseUrl || !jwtSecret) {
  console.error("DATABASE_URL and JWT_SECRET are required (see .env.example)");
  process.exit(1);
}

mkdirSync(dataDir, { recursive: true });

const rolodex = openRolodexDb(path.join(dataDir, "rolodex.sqlite"));
seedRolodex(rolodex);

const pool = createPool({ connectionString: databaseUrl });
const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);
await migrate(pool, migrationsDir);

const seedEmail = process.env.SEED_EMAIL ?? "marco@example.com";
const seedSlug = "novhora";
if (
  await seedAuth(pool, {
    name: "Novhora",
    slug: seedSlug,
    email: seedEmail,
    password: process.env.SEED_PASSWORD ?? "bench",
  })
) {
  console.log(`Seeded the login owner: ${seedEmail}`);
}

const tenant = await pool.query<{ id: number }>(
  "SELECT id FROM tenants WHERE slug = $1",
  [seedSlug],
);
const tenantId = tenant.rows[0].id;
if (!(await isSeeded(pool, tenantId))) {
  await seed(pool, tenantId);
  console.log("Seeded the CRM database with sample data");
}
await seedSpace(pool, tenantId);

createApp({ pool, jwtSecret, dbs: { rolodex } }).listen(port, () => {
  console.log(`Novhora running at http://localhost:${port}`);
});
