#!/usr/bin/env node
/**
 * The repo-specific half of the secrets check: what counts as PII here, and which files must never
 * be tracked. gitleaks covers credentials, which is a solved problem with a maintained ruleset.
 *
 * Scans tracked files only. One escape hatch: `allow-secret: <reason>` on the offending line, with
 * the reason required - a bare marker is not accepted.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** These exist to hold synthetic data, and that is the standing assumption. */
const SYNTHETIC = new Set([
  "server/src/crm/seed.ts",
  "server/src/space/seed.ts",
  "server/src/rolodex/seed.ts",
]);

// Bounded quantifiers: an unbounded local part backtracks badly on long lines.
const EMAIL = /[\w.+-]{1,64}@[\w-]{1,63}\.[a-z]{2,24}/gi;
/** Separators required, so plain runs of digits are not mistaken for phone numbers. */
const PHONE = /(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g;
const ALLOW = /allow-secret:\s*\S+/;

/**
 * RFC 2606 and RFC 6761 reserve these for documentation and testing. They are the email equivalent
 * of the 555-01xx block: a fixture using one cannot reach a real person.
 */
const RESERVED_DOMAIN =
  /@(?:example\.(?:com|net|org)|[\w-]+\.(?:example|test|invalid|localhost))$/i;

/** 555-01xx is the NANP block reserved for fiction; it cannot dial a real person. */
function isFictional(match) {
  const digits = match.replace(/\D/g, "");
  const local =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return (
    local.length === 10 &&
    local.slice(3, 6) === "555" &&
    local.startsWith("01", 6)
  );
}

function tracked() {
  return execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

const findings = [];
const files = tracked();

// Structural: gitignore is the first line of defence, this makes it durable.
for (const file of files) {
  if (
    file === ".env" ||
    (file.startsWith(".env.") && file !== ".env.example")
  ) {
    findings.push(`${file}: environment file is tracked`);
  }
  if (file === "data" || file.startsWith("data/")) {
    findings.push(`${file}: local database files must not be tracked`);
  }
}

for (const file of files) {
  if (SYNTHETIC.has(file)) continue;
  if (file === "scripts/check-secrets.mjs") continue;
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue; // unreadable or binary; nothing to scan
  }
  if (text.includes("\u0000")) continue; // binary

  text.split("\n").forEach((line, i) => {
    if (ALLOW.test(line)) return;
    for (const match of line.match(EMAIL) ?? []) {
      if (RESERVED_DOMAIN.test(match)) continue;
      findings.push(`${file}:${i + 1}: email address '${match}'`);
    }
    for (const match of line.match(PHONE) ?? []) {
      if (isFictional(match)) continue;
      findings.push(`${file}:${i + 1}: phone number '${match}'`);
    }
  });
}

if (findings.length > 0) {
  console.error(`check-secrets: ${findings.length} finding(s)\n`);
  for (const finding of findings) console.error(`  ${finding}`);
  console.error(
    "\nFixtures should use an example.com address or a 555-01xx number. Otherwise add" +
      " `allow-secret: <reason>` to the line.",
  );
  process.exit(1);
}

console.log(`check-secrets: clean (${files.length} tracked files)`);
