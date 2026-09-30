/**
 * Maintains `checks-baseline.json` from the latest reports in `.checks/`.
 *
 *   pnpm check:baseline --prune   Removes or shrinks entries no longer found.
 *                                 Needs no approval: it only shrinks.
 *   pnpm check:baseline --accept  Records every current block finding as
 *                                 debt. Adding entries needs Stuart's approval,
 *                                 so the change goes through a PR he reviews.
 *
 * Run the checks first (`pnpm check`) so the reports are current. Both modes
 * refuse a report older than the latest build in distDir.
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  BaselineError,
  entriesFor,
  parseBaseline,
  pruneBaseline,
  readBaseline,
  writeBaseline,
} from "./lib/baseline.mjs";
import { loadConfig } from "./lib/config.mjs";
import { REPORT_SCHEMA_VERSION, validateReport } from "./lib/report.mjs";
import { ROUTE_SOURCES_OUTPUT } from "./lib/source-map.mjs";

const { values } = parseArgs({
  options: {
    prune: { type: "boolean", default: false },
    accept: { type: "boolean", default: false },
  },
});
if (values.prune === values.accept) {
  console.error("Pass exactly one of --prune or --accept.");
  process.exit(2);
}

const config = await loadConfig();
const baselineFile = config.abs(config.baselineFile);
const outputDir = config.abs(config.outputDir);

/** @type {import("./lib/report.mjs").Report[]} */
const reports = fs.existsSync(outputDir)
  ? fs
      .readdirSync(outputDir)
      .filter((name) => name.endsWith(".json") && name !== ROUTE_SOURCES_OUTPUT)
      .map((name) => {
        const text = fs.readFileSync(path.join(outputDir, name), "utf8");
        let report;
        try {
          report = JSON.parse(text);
        } catch (error) {
          console.error(
            `${name} is not valid JSON (${/** @type {Error} */ (error).message}). Re-run the checks.`,
          );
          process.exit(2);
        }
        const problems = validateReport(report);
        if (problems.length > 0) {
          console.error(
            `${name} is not a schema ${REPORT_SCHEMA_VERSION} report (${problems[0]}). Re-run the checks.`,
          );
          process.exit(2);
        }
        return report;
      })
  : [];
if (reports.length === 0) {
  console.error(
    `No reports in ${config.outputDir}/. Run \`pnpm check\` first.`,
  );
  process.exit(2);
}
const filtered = reports
  .filter((r) => r.pageFilter !== null)
  .map((r) => r.check);
if (filtered.length > 0) {
  console.error(
    `The ${filtered.join(", ")} report was limited to some pages. Re-run it without --page.`,
  );
  process.exit(2);
}

// A report left in the output directory from before the latest build describes
// a site that no longer exists, so pruning or accepting from it would rewrite
// debt for pages nobody checked. The build time is the newest mtime of any HTML
// file in distDir: every build rewrites all of them, and no check writes there,
// so it tracks the latest build even when one page's file was left over.
const distDir = config.abs(config.distDir);
const builtAt = newestHtmlMtime(distDir);
if (builtAt === null) {
  console.error(
    `No built site in ${config.distDir}/. Run \`pnpm build\` and then \`pnpm check\` first.`,
  );
  process.exit(2);
}
const outdated = reports
  .filter((r) => Date.parse(r.generatedAt) < builtAt)
  .map((r) => r.check);
if (outdated.length > 0) {
  console.error(
    `The ${outdated.join(", ")} report predates the latest build in ${config.distDir}/. Re-run \`pnpm check\` so every report is current.`,
  );
  process.exit(2);
}

let baseline;
try {
  baseline = readBaseline(baselineFile);
} catch (error) {
  if (!(error instanceof BaselineError)) throw error;
  console.error(error.message);
  process.exit(2);
}

if (values.prune) {
  const stale = reports.flatMap((r) => r.stale);
  if (stale.length === 0) {
    console.log("Nothing to prune.");
    process.exit(0);
  }
  await writeBaseline(baselineFile, pruneBaseline(baseline, stale));
  console.log(
    `Pruned ${stale.length} entr${stale.length === 1 ? "y" : "ies"}.`,
  );
} else {
  // Rebuild the entries for the checks that reported, keep the rest.
  const checks = new Set(reports.map((r) => r.check));
  const entries = [
    ...baseline.entries.filter((e) => !checks.has(e.check)),
    ...entriesFor(reports.flatMap((r) => r.findings)),
  ];
  const next = parseBaseline({
    schemaVersion: baseline.schemaVersion,
    entries,
  });
  await writeBaseline(baselineFile, next);
  console.log(
    `Wrote ${next.entries.length} entries to ${config.baselineFile}. New entries need Stuart's approval before merge.`,
  );
}

/**
 * @param {string} dir Absolute.
 * @returns {number | null} Newest mtime in ms, or null when there is no HTML.
 */
function newestHtmlMtime(dir) {
  if (!fs.existsSync(dir)) return null;
  let newest = null;
  for (const entry of fs.readdirSync(dir, {
    recursive: true,
    withFileTypes: true,
  })) {
    if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
    const { mtimeMs } = fs.statSync(path.join(entry.parentPath, entry.name));
    if (newest === null || mtimeMs > newest) newest = mtimeMs;
  }
  return newest;
}
