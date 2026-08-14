import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb as openCrmDb } from "./crm/db.js";
import { isSeeded, seed } from "./crm/seed.js";
import { openDb as openSpaceDb } from "./space/db.js";
import { seedIfEmpty } from "./space/seed.js";
import { createApp } from "./app.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
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

createApp({ crm, space }).listen(port, () => {
  console.log(`Bench running at http://localhost:${port}`);
});
