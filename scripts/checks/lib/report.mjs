import fs from "node:fs";
import path from "node:path";
import { validateFinding } from "./findings.mjs";

/**
 * Report version. Bump it whenever a field in the report or in a finding
 * changes shape, so tools parsing `.checks/<check>.json` can refuse a version
 * they do not understand.
 */
export const REPORT_SCHEMA_VERSION = 1;

const STATUSES = ["new", "baselined", "warn"];

/**
 * @typedef {import("./findings.mjs").MergedFinding & { status: "new" | "baselined" | "warn" }} ReportedFinding
 *
 * @typedef {object} Report
 * @property {number} schemaVersion
 * @property {string} check
 * @property {string} generatedAt ISO timestamp.
 * @property {string[] | null} pageFilter Routes the run was limited to.
 * @property {{ new: number, baselined: number, warn: number }} summary
 * @property {ReportedFinding[]} findings
 * @property {Array<import("./baseline.mjs").BaselineEntry & { found: number }>} stale
 */

/**
 * @param {object} fields
 * @param {string} fields.check
 * @param {string[] | null} fields.pageFilter
 * @param {ReportedFinding[]} fields.findings
 * @param {Report["stale"]} fields.stale
 * @returns {Report}
 */
export function buildReport({ check, pageFilter, findings, stale }) {
  const summary = { new: 0, baselined: 0, warn: 0 };
  for (const finding of findings) summary[finding.status] += 1;
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    check,
    generatedAt: new Date().toISOString(),
    pageFilter,
    summary,
    findings,
    stale,
  };
}

/**
 * @param {unknown} report
 * @returns {string[]} Problems, empty when the report matches this version.
 */
export function validateReport(report) {
  if (typeof report !== "object" || report === null) return ["not an object"];
  const r = /** @type {Record<string, any>} */ (report);
  const problems = [];
  if (r.schemaVersion !== REPORT_SCHEMA_VERSION) {
    problems.push(`schemaVersion must be ${REPORT_SCHEMA_VERSION}`);
  }
  if (typeof r.check !== "string") problems.push("check must be a string");
  if (
    typeof r.generatedAt !== "string" ||
    Number.isNaN(Date.parse(r.generatedAt))
  ) {
    problems.push("generatedAt must be an ISO date");
  }
  if (r.pageFilter !== null && !Array.isArray(r.pageFilter)) {
    problems.push("pageFilter must be an array or null");
  }
  for (const key of STATUSES) {
    if (!Number.isInteger(r.summary?.[key])) {
      problems.push(`summary.${key} must be an integer`);
    }
  }
  if (!Array.isArray(r.findings)) {
    problems.push("findings must be an array");
  } else {
    r.findings.forEach((/** @type {any} */ f, /** @type {number} */ i) => {
      for (const p of validateFinding(f)) problems.push(`findings[${i}]: ${p}`);
      if (typeof f !== "object" || f === null) return;
      if (!Array.isArray(f.routes) || f.routes.length === 0) {
        problems.push(`findings[${i}]: routes must be a non-empty array`);
      }
      if (!STATUSES.includes(f.status)) {
        problems.push(
          `findings[${i}]: status must be one of ${STATUSES.join(", ")}`,
        );
      }
    });
  }
  if (!Array.isArray(r.stale)) {
    problems.push("stale must be an array");
  } else {
    // `--prune` writes `found` back as the entry's count, so a missing or
    // fractional one would leave a baseline the next run refuses to read.
    r.stale.forEach((/** @type {any} */ entry, /** @type {number} */ i) => {
      if (!(Number.isInteger(entry?.found) && entry.found >= 0)) {
        problems.push(`stale[${i}]: found must be a non-negative integer`);
      }
    });
  }
  return problems;
}

/**
 * Writes the report to its stable path, `<outputDir>/<check>.json`.
 *
 * @param {Report} report
 * @param {string} outputDir Absolute.
 * @returns {string} The path written.
 */
export function writeReport(report, outputDir) {
  fs.mkdirSync(outputDir, { recursive: true });
  const file = path.join(outputDir, `${report.check}.json`);
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}

/**
 * Where a finding is: a component and its pages, a check-formed group's
 * pages (whose sources the message lists), or one page.
 *
 * @param {ReportedFinding} finding
 */
function where(finding) {
  const pages = `${finding.routes.length} page(s): ${finding.routes.join(", ")}`;
  if (finding.component !== null) {
    return `at ${finding.component} (${finding.source}) on ${pages}`;
  }
  if (finding.group !== null) return `on ${pages}`;
  return `at ${finding.route} (${finding.source === "unknown" ? "source unknown" : finding.source})`;
}

/** @param {ReportedFinding} finding */
function describe(finding) {
  const lines = [`${finding.rule}: ${finding.message}`, `  ${where(finding)}`];
  if (finding.selector) lines.push(`  selector: ${finding.selector}`);
  if (finding.snippet) lines.push(`  html: ${finding.snippet}`);
  if (finding.helpUrl) lines.push(`  help: ${finding.helpUrl}`);
  return lines.join("\n");
}

/**
 * Renders the report as plain text: new block findings first, in full, then
 * warnings, then a one-line count of baselined debt.
 *
 * @param {Report} report
 * @returns {string}
 */
export function formatReport(report) {
  const bySeverity = (/** @type {string} */ status) =>
    report.findings.filter((f) => f.status === status);
  const out = [
    `[${report.check}] ${report.summary.new} blocking, ${report.summary.warn} warnings, ${report.summary.baselined} baselined`,
  ];
  if (report.pageFilter)
    out.push(`  limited to: ${report.pageFilter.join(", ")}`);
  for (const [status, label] of [
    ["new", "BLOCK"],
    ["warn", "WARN"],
  ]) {
    for (const finding of bySeverity(status)) {
      out.push(`${label} ${describe(finding)}`);
    }
  }
  if (report.stale.length > 0) {
    out.push(
      `${report.stale.length} baseline entr${report.stale.length === 1 ? "y is" : "ies are"} stale; run \`pnpm check:baseline --prune\` to remove:`,
    );
    for (const entry of report.stale) {
      out.push(
        `  ${entry.check}/${entry.rule} ${entry.component ?? entry.group ?? entry.route}: baseline ${entry.count}, found ${entry.found}`,
      );
    }
  }
  return out.join("\n");
}

/**
 * Markdown for the GitHub Actions job summary.
 *
 * @param {Report} report
 * @returns {string}
 */
export function formatSummaryMarkdown(report) {
  const { summary } = report;
  const lines = [
    `### ${report.check}: ${summary.new === 0 ? "passed" : "failed"}`,
    "",
    `${summary.new} blocking, ${summary.warn} warnings, ${summary.baselined} baselined.`,
  ];
  const rows = report.findings.filter((f) => f.status !== "baselined");
  if (rows.length > 0) {
    lines.push(
      "",
      "| Status | Rule | Where | Source | Message |",
      "| --- | --- | --- | --- | --- |",
    );
    for (const f of rows) {
      const cell = (/** @type {string} */ s) =>
        s.replaceAll("|", "\\|").replaceAll("\n", " ");
      lines.push(
        `| ${f.status === "new" ? "block" : "warn"} | ${cell(f.rule)} | ${cell(f.component ?? f.group ?? f.route)} | ${cell(f.source)} | ${cell(f.message)} |`,
      );
    }
  }
  return `${lines.join("\n")}\n`;
}
