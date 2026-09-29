import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  componentFor,
  createFinding,
  mergeFindings,
  validateFinding,
} from "./findings.mjs";
import { buildReport, validateReport } from "./report.mjs";
import { applyBaseline } from "./baseline.mjs";

const roots = [
  {
    name: "navbar",
    selector: "header",
    source: "src/components/navbar/navbar.astro",
  },
  {
    name: "footer",
    selector: "body > footer",
    source: "src/components/footer.astro",
  },
];

function finding(overrides = {}) {
  return createFinding({
    check: "a11y",
    rule: "image-alt",
    severity: "block",
    route: "/",
    distFile: "dist/index.html",
    message: "Image has no alt text",
    ...overrides,
  });
}

describe("createFinding", () => {
  it("fills optional fields with explicit nulls and an unknown source", () => {
    const f = finding();
    assert.equal(f.source, "unknown");
    assert.equal(f.selector, null);
    assert.equal(f.component, null);
    assert.deepEqual(validateFinding(f), []);
  });

  it("rejects an unknown severity", () => {
    assert.throws(
      () => finding({ severity: "error" }),
      /severity must be one of/,
    );
  });

  it("rejects a missing rule", () => {
    assert.throws(
      () => finding({ rule: "" }),
      /rule must be a non-empty string/,
    );
  });
});

describe("componentFor", () => {
  it("returns the first root that contains the element", () => {
    const inside = (sel) => sel === "body > footer";
    assert.equal(componentFor(inside, roots)?.name, "footer");
  });

  it("returns null outside every root", () => {
    assert.equal(
      componentFor(() => false, roots),
      null,
    );
  });
});

describe("mergeFindings", () => {
  it("merges an image-alt finding under the header root on two pages into one", () => {
    const merged = mergeFindings([
      finding({ route: "/faqs/", component: "navbar", selector: "header img" }),
      finding({ route: "/", component: "navbar", selector: "header img" }),
    ]);
    assert.equal(merged.length, 1);
    assert.deepEqual(merged[0].routes, ["/", "/faqs/"]);
    assert.equal(merged[0].component, "navbar");
  });

  it("keeps two main > h1 findings on different pages separate", () => {
    const merged = mergeFindings([
      finding({
        check: "seo",
        rule: "h1-count",
        route: "/",
        selector: "main > h1",
      }),
      finding({
        check: "seo",
        rule: "h1-count",
        route: "/faqs/",
        selector: "main > h1",
      }),
    ]);
    assert.equal(merged.length, 2);
    assert.deepEqual(
      merged.map((f) => f.routes),
      [["/"], ["/faqs/"]],
    );
  });

  it("keeps different elements in the same component separate", () => {
    const merged = mergeFindings([
      finding({ component: "navbar", selector: "header img.logo" }),
      finding({ component: "navbar", selector: "header img.badge" }),
    ]);
    assert.equal(merged.length, 2);
  });

  it("keeps an unmappable page finding with its route, selector and unknown source", () => {
    const [f] = mergeFindings([
      finding({
        route: "/mystery/",
        distFile: "dist/mystery/index.html",
        selector: "img",
      }),
    ]);
    assert.equal(f.source, "unknown");
    assert.equal(f.selector, "img");
    assert.deepEqual(f.routes, ["/mystery/"]);
  });
});

describe("report", () => {
  it("validates against the versioned schema", () => {
    const merged = mergeFindings([
      finding(),
      finding({
        severity: "warn",
        rule: "region",
        component: "footer",
        selector: "footer",
      }),
    ]);
    const applied = applyBaseline(
      merged,
      { schemaVersion: 1, entries: [] },
      { checks: ["a11y"], complete: true },
    );
    const report = buildReport({ check: "a11y", pageFilter: null, ...applied });
    assert.deepEqual(validateReport(report), []);
    assert.deepEqual(report.summary, { new: 1, baselined: 0, warn: 1 });
  });

  it("rejects a report from another schema version", () => {
    const report = buildReport({
      check: "a11y",
      pageFilter: null,
      findings: [],
      stale: [],
    });
    assert.match(
      validateReport({ ...report, schemaVersion: 99 })[0],
      /schemaVersion/,
    );
  });
});
