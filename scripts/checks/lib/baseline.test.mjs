import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import * as prettier from "prettier";
import {
  applyBaseline,
  BaselineError,
  entriesFor,
  parseBaseline,
  pruneBaseline,
  readBaseline,
  writeBaseline,
} from "./baseline.mjs";
import { createFinding, mergeFindings } from "./findings.mjs";

const scope = { checks: ["seo", "a11y"], complete: true };

function finding(overrides = {}) {
  return createFinding({
    check: "seo",
    rule: "h1-count",
    severity: "block",
    route: "/",
    distFile: "dist/index.html",
    message: "Page has 2 <h1> elements",
    ...overrides,
  });
}

function baseline(entries) {
  return { schemaVersion: 1, entries };
}

function statuses(result) {
  return result.findings.map((f) => f.status);
}

describe("applyBaseline", () => {
  it("passes block findings within their baseline key and count", () => {
    const findings = mergeFindings([
      finding({ selector: "h1:nth-of-type(1)" }),
      finding({ selector: "h1:nth-of-type(2)" }),
    ]);
    const result = applyBaseline(
      findings,
      baseline([{ check: "seo", rule: "h1-count", route: "/", count: 2 }]),
      scope,
    );
    assert.deepEqual(statuses(result), ["baselined", "baselined"]);
  });

  it("blocks a third instance where the baseline records two", () => {
    const findings = mergeFindings(
      [1, 2, 3].map((n) => finding({ selector: `h1:nth-of-type(${n})` })),
    );
    const result = applyBaseline(
      findings,
      baseline([{ check: "seo", rule: "h1-count", route: "/", count: 2 }]),
      scope,
    );
    assert.deepEqual(statuses(result), ["new", "new", "new"]);
  });

  it("does not block a new page inheriting a baselined component finding", () => {
    const findings = mergeFindings([
      finding({
        check: "a11y",
        rule: "image-alt",
        component: "navbar",
        selector: "header img",
      }),
      finding({
        check: "a11y",
        rule: "image-alt",
        component: "navbar",
        selector: "header img",
        route: "/brand-new-page/",
        distFile: "dist/brand-new-page/index.html",
      }),
    ]);
    const result = applyBaseline(
      findings,
      baseline([
        { check: "a11y", rule: "image-alt", component: "navbar", count: 1 },
      ]),
      scope,
    );
    assert.deepEqual(statuses(result), ["baselined"]);
  });

  it("blocks a finding with no baseline entry, and reports warnings as warn", () => {
    const findings = mergeFindings([
      finding(),
      finding({ severity: "warn", rule: "description-length" }),
    ]);
    const result = applyBaseline(findings, baseline([]), scope);
    assert.deepEqual(statuses(result), ["new", "warn"]);
  });

  it("lists entries with no matching finding, and entries whose count fell", () => {
    const result = applyBaseline(
      mergeFindings([finding()]),
      baseline([
        { check: "seo", rule: "h1-count", route: "/", count: 3 },
        { check: "seo", rule: "canonical-missing", route: "/faqs/", count: 1 },
      ]),
      scope,
    );
    assert.deepEqual(result.stale, [
      { check: "seo", rule: "h1-count", route: "/", count: 3, found: 1 },
      {
        check: "seo",
        rule: "canonical-missing",
        route: "/faqs/",
        count: 1,
        found: 0,
      },
    ]);
  });

  it("never reports stale entries for checks that did not run, or a filtered run", () => {
    const entries = [
      { check: "a11y", rule: "image-alt", route: "/", count: 1 },
    ];
    assert.deepEqual(
      applyBaseline([], baseline(entries), { checks: ["seo"], complete: true })
        .stale,
      [],
    );
    assert.deepEqual(
      applyBaseline([], baseline(entries), {
        checks: ["a11y"],
        complete: false,
      }).stale,
      [],
    );
  });
});

describe("entriesFor", () => {
  it("never writes a warn finding to the baseline", () => {
    const entries = entriesFor(
      mergeFindings([
        finding({ severity: "warn", rule: "title-length" }),
        finding(),
        finding({ selector: "h1.second" }),
      ]),
    );
    assert.deepEqual(entries, [
      { check: "seo", rule: "h1-count", route: "/", count: 2 },
    ]);
  });

  it("keys component findings by component, never by route", () => {
    const entries = entriesFor(
      mergeFindings([
        finding({
          check: "a11y",
          rule: "link-name",
          component: "footer",
          selector: "footer a",
        }),
      ]),
    );
    assert.deepEqual(entries, [
      { check: "a11y", rule: "link-name", component: "footer", count: 1 },
    ]);
  });
});

describe("pruneBaseline", () => {
  it("removes entries with no finding and shrinks counts that fell", () => {
    const current = baseline([
      { check: "seo", rule: "h1-count", route: "/", count: 3 },
      { check: "seo", rule: "canonical-missing", route: "/faqs/", count: 1 },
      { check: "a11y", rule: "image-alt", component: "navbar", count: 1 },
    ]);
    const { stale } = applyBaseline(mergeFindings([finding()]), current, {
      checks: ["seo"],
      complete: true,
    });
    assert.deepEqual(pruneBaseline(current, stale).entries, [
      { check: "seo", rule: "h1-count", route: "/", count: 1 },
      { check: "a11y", rule: "image-alt", component: "navbar", count: 1 },
    ]);
  });
});

describe("reading and writing", () => {
  it("fails a malformed baseline with a clear message", () => {
    assert.throws(
      () =>
        parseBaseline({
          schemaVersion: 1,
          entries: [{ check: "seo", rule: "x", count: 1 }],
        }),
      (error) =>
        error instanceof BaselineError &&
        /exactly one of "component" or "route"/.test(error.message),
    );
    assert.throws(
      () => parseBaseline({ entries: [] }),
      /schemaVersion must be 1/,
    );
    assert.throws(
      () =>
        parseBaseline(
          baseline([
            { check: "seo", rule: "x", route: "/", count: 1, query: "leaked" },
          ]),
        ),
      /unexpected keys: query/,
    );
  });

  it("fails a baseline file that is not JSON", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "checks-"));
    const file = path.join(dir, "checks-baseline.json");
    try {
      fs.writeFileSync(file, "{ not json");
      assert.throws(
        () => readBaseline(file),
        /Malformed baseline: .* is not valid JSON/,
      );
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  it("writes a sorted baseline that Prettier already accepts", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "checks-"));
    const file = path.join(dir, "checks-baseline.json");
    try {
      await writeBaseline(
        file,
        baseline([
          { check: "seo", rule: "h1-count", route: "/", count: 1 },
          { check: "a11y", rule: "image-alt", component: "navbar", count: 1 },
        ]),
      );
      const text = fs.readFileSync(file, "utf8");
      assert.equal(await prettier.check(text, { filepath: file }), true);
      assert.equal(JSON.parse(text).entries[0].component, "navbar");
      assert.deepEqual(readBaseline(file).entries.length, 2);
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });

  it("treats a missing baseline file as empty", () => {
    assert.deepEqual(
      readBaseline("/nonexistent/checks-baseline.json").entries,
      [],
    );
  });
});
