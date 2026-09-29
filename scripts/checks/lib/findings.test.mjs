import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  componentFor,
  createFinding,
  mergeFindings,
  validateFinding,
} from "./findings.mjs";
import {
  buildReport,
  formatReport,
  formatSummaryMarkdown,
  validateReport,
} from "./report.mjs";
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
    assert.equal(f.group, null);
    assert.deepEqual(validateFinding(f), []);
  });

  it("accepts a group name and rejects a non-string one", () => {
    assert.equal(finding({ group: "title:same" }).group, "title:same");
    assert.throws(
      () => finding({ group: 1 }),
      /group must be a string or null/,
    );
    assert.deepEqual(validateFinding({ ...finding(), group: undefined }), [
      "group must be a string or null",
    ]);
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

  it("merges findings in the same group across pages, with no component", () => {
    const merged = mergeFindings([
      finding({ route: "/g/", group: "title:same", selector: "head > title" }),
      finding({ route: "/f/", group: "title:same", selector: "head > title" }),
    ]);
    assert.equal(merged.length, 1);
    assert.deepEqual(merged[0].routes, ["/f/", "/g/"]);
    assert.equal(merged[0].component, null);
    assert.equal(merged[0].group, "title:same");
  });

  it("keeps different groups separate", () => {
    const merged = mergeFindings([
      finding({ route: "/a/", group: "title:one", selector: "head > title" }),
      finding({ route: "/b/", group: "title:two", selector: "head > title" }),
    ]);
    assert.deepEqual(
      merged.map((f) => [f.group, f.routes]),
      [
        ["title:one", ["/a/"]],
        ["title:two", ["/b/"]],
      ],
    );
  });

  it("keeps a warn and a block on the same component element apart, so the block survives", () => {
    const merged = mergeFindings([
      finding({
        route: "/a/",
        severity: "warn",
        component: "navbar",
        selector: "header img",
      }),
      finding({
        route: "/b/",
        severity: "block",
        component: "navbar",
        selector: "header img",
      }),
    ]);
    assert.deepEqual(
      merged.map((f) => [f.severity, f.routes]),
      [
        ["warn", ["/a/"]],
        ["block", ["/b/"]],
      ],
    );
    const { findings } = applyBaseline(
      merged,
      { schemaVersion: 1, entries: [] },
      { checks: ["a11y"], complete: true },
    );
    assert.deepEqual(
      findings.map((f) => f.status),
      ["warn", "new"],
    );
  });

  it("keeps a finding with neither component nor group as a page finding", () => {
    const merged = mergeFindings([
      finding({ route: "/a/", selector: "head > title" }),
      finding({ route: "/b/", selector: "head > title" }),
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

  it("renders a group finding by its pages, never as a component", () => {
    const merged = mergeFindings(
      ["/f/", "/g/"].map((route) =>
        finding({
          check: "seo",
          rule: "title-duplicate",
          route,
          source: `src/pages${route}index.astro`,
          selector: "head > title",
          group: "title:same",
        }),
      ),
    );
    const applied = applyBaseline(
      merged,
      { schemaVersion: 1, entries: [] },
      { checks: ["seo"], complete: true },
    );
    const report = buildReport({ check: "seo", pageFilter: null, ...applied });
    assert.deepEqual(validateReport(report), []);
    const text = formatReport(report);
    assert.match(text, /\n {2}on 2 page\(s\): \/f\/, \/g\/\n/);
    assert.doesNotMatch(text, /title:same \(/);
    assert.match(formatSummaryMarkdown(report), /\| title:same \|/);
  });

  it("reports a finding that is not an object instead of throwing", () => {
    const report = buildReport({
      check: "a11y",
      pageFilter: null,
      findings: [],
      stale: [],
    });
    for (const bad of [null, 1, "x"]) {
      assert.deepEqual(validateReport({ ...report, findings: [bad] }), [
        "findings[0]: not an object",
      ]);
    }
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
