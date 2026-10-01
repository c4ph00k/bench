import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { migrate } from "./db/migrate.js";
import { createPool } from "./db/pool.js";
import { openDb as openCrmDb } from "./crm/db.js";
import { isSeeded, seed } from "./crm/seed.js";
import { openDb as openRolodexDb } from "./rolodex/db/index.js";
import { seedIfEmpty as seedRolodex } from "./rolodex/seed.js";
import { openDb as openSpaceDb } from "./space/db.js";
import { seedIfEmpty } from "./space/seed.js";
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

const crm = openCrmDb(path.join(dataDir, "crm.sqlite"));
if (!isSeeded(crm)) {
  seed(crm);
  console.log("Seeded the CRM database with sample data");
}

const space = openSpaceDb(path.join(dataDir, "personal-space.db"));
seedIfEmpty(space);

const rolodex = openRolodexDb(path.join(dataDir, "rolodex.sqlite"));
seedRolodex(rolodex);

const pool = createPool({ connectionString: databaseUrl });
const migrationsDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);
await migrate(pool, migrationsDir);

if (
  await seedAuth(pool, {
    name: "Novhora",
    slug: "novhora",
    email: process.env.SEED_EMAIL ?? "marco@example.com",
    password: process.env.SEED_PASSWORD ?? "bench",
  })
) {
  console.log(
    `Seeded the login owner: ${process.env.SEED_EMAIL ?? "marco@example.com"}`,
  );
}

createApp({ pool, jwtSecret, dbs: { crm, space, rolodex } }).listen(
  port,
  () => {
    console.log(`Novhora running at http://localhost:${port}`);
  },
);
