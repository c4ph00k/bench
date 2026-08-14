#!/usr/bin/env node
/**
 * Claude Code Stop hook: hold the turn open while `npm run lint` fails, and hand ESLint's own
 * messages back so the agent has something to act on rather than "lint failed".
 *
 * The loop hazard is the thing to get right. A hook that blocks on failure can cycle forever: the
 * agent stops, the hook blocks, it cannot fix the problem, it stops again. CONTROLS.md planned to
 * read `stop_hook_active` from the hook input to detect that, but the field is no longer in the
 * hooks documentation, so this keeps its own marker per session instead: one block, then the next
 * failure lets the stop through with a warning. That caps the cost at one extra turn either way.
 */
import { execFileSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const input = JSON.parse(readFileSync(0, "utf8"));
const marker = join(tmpdir(), `bench-stop-lint-${input.session_id}`);

function lint() {
  try {
    execFileSync("npm", ["run", "lint"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return null;
  } catch (error) {
    return `${error.stdout}${error.stderr}`;
  }
}

const failure = lint();

if (!failure) {
  rmSync(marker, { force: true });
  process.exit(0);
}

if (existsSync(marker)) {
  rmSync(marker, { force: true });
  console.log(
    JSON.stringify({
      systemMessage: "Lint still failing after one attempt - stop allowed.",
    }),
  );
  process.exit(0);
}

writeFileSync(marker, "");
console.error(`npm run lint failed. Fix these, then finish:\n\n${failure}`);
process.exit(2);
