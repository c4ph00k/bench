import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Build the frontend once, then hand each worker a clean slate to seed into. */
export default function globalSetup() {
  rmSync(path.join(root, "e2e", ".tmp"), { recursive: true, force: true });
  execFileSync("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
}
