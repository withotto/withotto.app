import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.mjs";
import { createFinding } from "./findings.mjs";
import { finishRun } from "./run.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const baseConfig = await loadConfig(repoRoot);

/** @type {string} */
let root;
/** @type {string | undefined} */
let summaryFile;

beforeEach((t) => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "checks-run-"));
  summaryFile = process.env.GITHUB_STEP_SUMMARY;
  delete process.env.GITHUB_STEP_SUMMARY;
  t.mock.method(console, "log", () => {});
  t.mock.method(console, "error", () => {});
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  if (summaryFile !== undefined) process.env.GITHUB_STEP_SUMMARY = summaryFile;
});

/** A config rooted in the temp dir, with the given excluded routes. */
function config(/** @type {string[]} */ excluded = []) {
  return {
    ...baseConfig,
    root,
    abs: (/** @type {string} */ p) => path.resolve(root, p),
    exclusions: { routes: excluded },
  };
}

const blocking = (/** @type {string} */ route) =>
  createFinding({
    check: "seo",
    rule: "h1-count",
    severity: "block",
    route,
    distFile: `dist${route}index.html`,
    message: "No H1.",
  });

const writeBaselineFile = (/** @type {string} */ text) =>
  fs.writeFileSync(path.join(root, baseConfig.baselineFile), text);

const readReport = () =>
  JSON.parse(
    fs.readFileSync(path.join(root, baseConfig.outputDir, "seo.json"), "utf8"),
  );

describe("finishRun", () => {
  it("returns 1 for a block finding beyond the baseline", () => {
    const code = finishRun({
      check: "seo",
      findings: [blocking("/a/")],
      pages: null,
      config: config(),
    });
    assert.equal(code, 1);
    assert.equal(readReport().summary.new, 1);
  });

  it("returns 0 when the baseline covers the block finding", () => {
    writeBaselineFile(
      JSON.stringify({
        schemaVersion: 1,
        entries: [{ check: "seo", rule: "h1-count", route: "/a/", count: 1 }],
      }),
    );
    const code = finishRun({
      check: "seo",
      findings: [blocking("/a/")],
      pages: null,
      config: config(),
    });
    assert.equal(code, 0);
    assert.equal(readReport().summary.baselined, 1);
  });

  it("returns 2 and writes no report when the baseline is malformed", () => {
    writeBaselineFile("{ not json");
    const code = finishRun({
      check: "seo",
      findings: [blocking("/a/")],
      pages: null,
      config: config(),
    });
    assert.equal(code, 2);
    assert.equal(
      fs.existsSync(path.join(root, baseConfig.outputDir, "seo.json")),
      false,
    );
  });

  it("drops findings on an excluded route, in any spelling", () => {
    const code = finishRun({
      check: "seo",
      findings: [blocking("/drafts/"), blocking("/b/")],
      pages: null,
      config: config(["/drafts"]),
    });
    assert.equal(code, 1);
    assert.deepEqual(
      readReport().findings.map((/** @type {any} */ f) => f.route),
      ["/b/"],
    );
  });
});
