import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { createFinding } from "./lib/findings.mjs";
import { buildReport } from "./lib/report.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, "baseline.mjs");

const CONFIG = `export default {
  site: "https://example.test",
  distDir: "dist",
  pagesDir: "src/pages",
  redirectsFile: "_redirects",
  sitemapIndex: "sitemap-index.xml",
  trailingSlash: "always",
  outputDir: ".checks",
  baselineFile: "checks-baseline.json",
  componentRoots: [],
  blockedHosts: [],
  previewPort: 4391,
  exclusions: { routes: [] },
};
`;

/** @type {string} */
let root;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "checks-baseline-"));
  fs.writeFileSync(path.join(root, "checks.config.mjs"), CONFIG);
  fs.mkdirSync(path.join(root, "dist"));
  fs.writeFileSync(path.join(root, "dist", "index.html"), "<html></html>");
  fs.mkdirSync(path.join(root, ".checks"));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

/** Sets the build time, as the newest HTML file's mtime. */
function builtAt(/** @type {Date} */ when) {
  fs.utimesSync(path.join(root, "dist", "index.html"), when, when);
}

/**
 * @param {object} fields
 * @param {string} fields.check
 * @param {Date} fields.at generatedAt.
 * @param {any[]} [fields.findings]
 * @param {any[]} [fields.stale]
 * @param {string[] | null} [fields.pageFilter]
 */
function writeReport({
  check,
  at,
  findings = [],
  stale = [],
  pageFilter = null,
}) {
  const report = buildReport({ check, pageFilter, findings, stale });
  report.generatedAt = at.toISOString();
  fs.writeFileSync(
    path.join(root, ".checks", `${check}.json`),
    JSON.stringify(report),
  );
}

function writeBaseline(/** @type {any[]} */ entries) {
  fs.writeFileSync(
    path.join(root, "checks-baseline.json"),
    JSON.stringify({ schemaVersion: 1, entries }),
  );
}

const readEntries = () =>
  JSON.parse(fs.readFileSync(path.join(root, "checks-baseline.json"), "utf8"))
    .entries;

const run = (/** @type {string} */ flag) =>
  spawnSync(process.execPath, [cli, flag], { cwd: root, encoding: "utf8" });

const blockFinding = (
  /** @type {string} */ check,
  /** @type {string} */ rule,
) => ({
  ...createFinding({
    check,
    rule,
    severity: "block",
    route: "/",
    distFile: "dist/index.html",
    message: "Something is wrong.",
  }),
  routes: ["/"],
  status: "new",
});

const BUILD = new Date("2026-09-01T12:00:00Z");
const BEFORE = new Date("2026-09-01T11:00:00Z");
const AFTER = new Date("2026-09-01T13:00:00Z");

const seoEntry = { check: "seo", rule: "h1-count", route: "/", count: 1 };
const a11yEntry = { check: "a11y", rule: "image-alt", route: "/", count: 1 };

describe("check:baseline", () => {
  it("fails cleanly on a report that is not valid JSON", () => {
    builtAt(BUILD);
    writeBaseline([seoEntry]);
    fs.writeFileSync(path.join(root, ".checks", "seo.json"), "{ truncated");

    const result = run("--prune");

    assert.equal(result.status, 2);
    assert.match(result.stderr, /seo\.json is not valid JSON/);
    assert.doesNotMatch(result.stderr, /at JSON\.parse/);
  });

  it("refuses to prune from a report older than the latest build", () => {
    builtAt(BUILD);
    writeBaseline([seoEntry, a11yEntry]);
    writeReport({ check: "seo", at: AFTER });
    writeReport({
      check: "a11y",
      at: BEFORE,
      stale: [{ ...a11yEntry, found: 0 }],
    });

    const result = run("--prune");

    assert.equal(result.status, 2);
    assert.match(result.stderr, /a11y report predates the latest build/);
    assert.deepEqual(readEntries(), [seoEntry, a11yEntry]);
  });

  it("refuses to accept from a report older than the latest build", () => {
    builtAt(BUILD);
    writeBaseline([seoEntry]);
    writeReport({ check: "seo", at: BEFORE });

    const result = run("--accept");

    assert.equal(result.status, 2);
    assert.match(result.stderr, /seo report predates the latest build/);
    assert.deepEqual(readEntries(), [seoEntry]);
  });

  it("refuses when there is no built site", () => {
    fs.rmSync(path.join(root, "dist"), { recursive: true });
    writeBaseline([seoEntry]);
    writeReport({ check: "seo", at: AFTER });

    const result = run("--prune");

    assert.equal(result.status, 2);
    assert.match(result.stderr, /No built site in dist\//);
  });

  it("prunes a stale entry from a report newer than the build", () => {
    builtAt(BUILD);
    writeBaseline([seoEntry, a11yEntry]);
    writeReport({
      check: "seo",
      at: AFTER,
      stale: [{ ...seoEntry, found: 0 }],
    });

    const result = run("--prune");

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(readEntries(), [a11yEntry]);
  });

  it("accepts findings and keeps entries of checks that did not report", () => {
    builtAt(BUILD);
    writeBaseline([seoEntry, a11yEntry]);
    writeReport({
      check: "seo",
      at: AFTER,
      findings: [blockFinding("seo", "title-length")],
    });

    const result = run("--accept");

    assert.equal(result.status, 0, result.stderr);
    const entries = readEntries();
    assert.deepEqual(entries.map((e) => `${e.check}/${e.rule}`).sort(), [
      "a11y/image-alt",
      "seo/title-length",
    ]);
  });

  it("refuses a report limited by a page filter", () => {
    builtAt(BUILD);
    writeBaseline([seoEntry]);
    writeReport({
      check: "seo",
      at: AFTER,
      pageFilter: ["/"],
      stale: [{ ...seoEntry, found: 0 }],
    });

    const result = run("--prune");

    assert.equal(result.status, 2);
    assert.match(result.stderr, /limited to some pages/);
    assert.deepEqual(readEntries(), [seoEntry]);
  });
});
