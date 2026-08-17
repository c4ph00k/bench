#!/usr/bin/env node
/**
 * Runs gitleaks, failing with an actionable message when the binary is not installed. A control
 * that quietly passes without its tool is worse than no control.
 *
 * A script rather than a one-liner in package.json: npm runs scripts through cmd.exe on Windows,
 * where `command -v gitleaks >/dev/null || { ...; }` is not syntax, so the check failed there even
 * with gitleaks installed.
 */
import { spawnSync } from "node:child_process";

const result = spawnSync("gitleaks", ["dir", ".", "--no-banner", "--redact"], {
  stdio: "inherit",
});

if (result.error) {
  if (result.error.code !== "ENOENT") throw result.error;
  console.error(
    [
      "gitleaks is required for this check and was not found on PATH.",
      "  macOS:   brew install gitleaks",
      "  Windows: winget install -e --id Gitleaks.Gitleaks",
    ].join("\n"),
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
