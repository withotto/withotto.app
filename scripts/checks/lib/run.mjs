import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { applyBaseline, BaselineError, readBaseline } from "./baseline.mjs";
import { mergeFindings } from "./findings.mjs";
import {
  buildReport,
  formatReport,
  formatSummaryMarkdown,
  writeReport,
} from "./report.mjs";
import { distFileToRoute } from "./source-map.mjs";

/**
 * Parses the options every check accepts. `--page` (repeatable) limits what
 * is reported to those routes; checks still analyse every page when they need
 * the whole site, e.g. for uniqueness.
 *
 * @param {string[]} [argv]
 * @returns {{ pages: string[] | null }}
 */
export function parseCheckArgs(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: { page: { type: "string", multiple: true } },
    allowPositionals: false,
  });
  const pages = values.page?.map(canonicalRoute) ?? null;
  return { pages };
}

/**
 * Normalises a route typed by hand: "capture" or "/capture" becomes
 * "/capture/".
 *
 * @param {string} route
 */
export function canonicalRoute(route) {
  const trimmed = route.replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? "/" : `/${trimmed}/`;
}

/**
 * Lists every built HTML page as `{ distFile, route }`, sorted by route.
 *
 * @param {string} distAbs Absolute path to dist/.
 * @param {string} root Repo root, for repo-relative `distFile`s.
 */
export function listPages(distAbs, root) {
  if (!fs.existsSync(distAbs)) {
    throw new Error(
      `${path.relative(root, distAbs)}/ not found. Run \`pnpm build\` first.`,
    );
  }
  return fs
    .readdirSync(distAbs, { recursive: true, encoding: "utf8" })
    .filter((rel) => rel.endsWith(".html"))
    .map((rel) => ({
      distFile: path
        .relative(root, path.join(distAbs, rel))
        .split(path.sep)
        .join("/"),
      route: distFileToRoute(rel),
    }))
    .sort((a, b) => a.route.localeCompare(b.route));
}

/**
 * Merges raw findings, applies the baseline, writes and prints the report,
 * and returns the exit code: 1 when any block finding is beyond the baseline,
 * 2 when the baseline itself is unreadable, else 0.
 *
 * @param {object} options
 * @param {string} options.check
 * @param {import("./findings.mjs").Finding[]} options.findings
 * @param {string[] | null} options.pages Page filter, if any.
 * @param {Awaited<ReturnType<import("./config.mjs").loadConfig>>} options.config
 * @returns {number}
 */
export function finishRun({ check, findings, pages, config }) {
  let baseline;
  try {
    baseline = readBaseline(config.abs(config.baselineFile));
  } catch (error) {
    if (error instanceof BaselineError) {
      console.error(`${config.baselineFile}: ${error.message}`);
      return 2;
    }
    throw error;
  }

  const excluded = new Set(config.exclusions.routes.map(canonicalRoute));
  const inScope = findings.filter(
    (f) =>
      !excluded.has(f.route) && (pages === null || pages.includes(f.route)),
  );
  const applied = applyBaseline(mergeFindings(inScope), baseline, {
    checks: [check],
    complete: pages === null,
  });
  const report = buildReport({ check, pageFilter: pages, ...applied });
  const file = writeReport(report, config.abs(config.outputDir));

  console.log(formatReport(report));
  console.log(`Report: ${path.relative(config.root, file)}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      formatSummaryMarkdown(report),
    );
  }
  return report.summary.new > 0 ? 1 : 0;
}
