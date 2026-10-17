/**
 * Runs Node's test runner over the files a glob matches, and fails when it
 * matches none: `node --test "<glob>"` alone exits 0 with zero tests, so a
 * moved or renamed test folder would leave `pnpm check` and CI green.
 * Usage: node scripts/run-tests.mjs "<glob>"
 */
import { spawnSync } from "node:child_process";
import { globSync } from "node:fs";

const [pattern] = process.argv.slice(2);
if (!pattern) {
  console.error("Usage: node scripts/run-tests.mjs <glob>");
  process.exit(1);
}

const files = globSync(pattern);
if (files.length === 0) {
  console.error(`No test files match ${pattern}`);
  process.exit(1);
}

const { status } = spawnSync(process.execPath, ["--test", ...files], {
  stdio: "inherit",
});
process.exit(status ?? 1);
