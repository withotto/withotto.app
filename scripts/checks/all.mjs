/**
 * `pnpm check`: the local mirror of the checks workflow. Tests the check
 * scripts, builds once, then runs every check against that build. Each check
 * runs even when an earlier one fails, so one run reports everything, the same
 * way the CI workflow does. Extra arguments (e.g. `--page /capture/`)
 * go to the SEO and accessibility checks.
 */
import { spawnSync } from "node:child_process";

const passThrough = process.argv.slice(2);

/** @param {string[]} args */
function run(args) {
  console.log(`\n$ pnpm ${args.join(" ")}`);
  return spawnSync("pnpm", args, { stdio: "inherit" }).status ?? 1;
}

if (run(["test:checks"]) !== 0) process.exit(1);
if (run(["build"]) !== 0) process.exit(1);

const failed = [
  ["check:seo", ...passThrough],
  ["check:a11y", ...passThrough],
  ["check:links"],
].filter((args) => run(args) !== 0);

if (failed.length > 0) {
  console.error(`\nFailed: ${failed.map((args) => args[0]).join(", ")}`);
  process.exit(1);
}
