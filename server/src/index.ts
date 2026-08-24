import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb as openCrmDb } from "./crm/db.js";
import { isSeeded, seed } from "./crm/seed.js";
import { openDb as openRolodexDb } from "./rolodex/db/index.js";
import { seedIfEmpty as seedRolodex } from "./rolodex/seed.js";
import { openDb as openSpaceDb } from "./space/db.js";
import { seedIfEmpty } from "./space/seed.js";
import { createApp } from "./app.js";
import { openDb as openAuthDb, seedIfEmpty as seedAuth } from "./auth/db.js";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const dataDir = path.resolve(root, process.env.DATA_DIR ?? "data");
const port = Number(process.env.PORT ?? 8100);

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

const authDb = openAuthDb(path.join(dataDir, "auth.sqlite"));
if (seedAuth(authDb, "marco", "bench"))
  console.log("Seeded the login user: marco (password bench)");

createApp({ crm, space, rolodex, auth: authDb }).listen(port, () => {
  console.log(`Novhora running at http://localhost:${port}`);
});
