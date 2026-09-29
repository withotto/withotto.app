import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./lib/config.mjs";
import { mergeFindings } from "./lib/findings.mjs";
import { finishRun } from "./lib/run.mjs";
import {
  analyseSite,
  extractHead,
  parseRedirects,
  validateJsonLd,
} from "./seo.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const baseConfig = await loadConfig(repoRoot);

/** A config whose paths resolve inside a fixture site. */
function fixtureConfig(name) {
  const root = path.join(here, "fixtures", "seo", name);
  return { ...baseConfig, root, abs: (p) => path.resolve(root, p) };
}

const analyse = (name) => analyseSite(fixtureConfig(name));
const withRule = (findings, rule) => findings.filter((f) => f.rule === rule);
const summary = (findings) =>
  findings.map((f) => `${f.severity} ${f.rule} ${f.route}`).sort();

describe("extractHead", () => {
  const html = `<!doctype html><html><head><title> Head title  text </title>
    <meta name="description" content="Some description">
    <link rel="canonical" href="https://withotto.app/x/">
    <meta name="robots" content="noindex"></head>
    <body><header><svg><title>Icon title</title></svg></header>
    <h1>First <em>heading</em></h1><h1>Second</h1></body></html>`;

  it("reads the title from the head, not an SVG title in the body", () => {
    const head = extractHead(html);
    assert.equal(head.title, "Head title text");
    assert.deepEqual(head.titles, ["Head title text"]);
  });

  it("reads the description, canonical, robots and every H1", () => {
    const head = extractHead(html);
    assert.equal(head.description, "Some description");
    assert.equal(head.canonical, "https://withotto.app/x/");
    assert.equal(head.robots, "noindex");
    assert.deepEqual(head.h1s, ["First heading", "Second"]);
  });

  it("returns nulls when the head has none of them", () => {
    const head = extractHead("<html><head></head><body></body></html>");
    assert.equal(head.title, null);
    assert.equal(head.description, null);
    assert.equal(head.canonical, null);
    assert.equal(head.robots, null);
    assert.deepEqual(head.h1s, []);
  });
});

describe("a clean site", () => {
  it("has no findings: valid, array and @graph JSON-LD, no JSON-LD, SVG titles, file links, redirect fragments", () => {
    assert.deepEqual(summary(analyse("clean")), []);
  });
});

describe("headings", () => {
  const findings = analyse("headings");

  it("blocks a page with two H1s, once, on the extra H1", () => {
    const found = withRule(findings, "h1-multiple");
    assert.equal(found.length, 1);
    assert.equal(found[0].severity, "block");
    assert.equal(found[0].route, "/two-h1/");
    assert.match(found[0].selector, /h1/);
    assert.match(found[0].message, /Second heading/);
  });

  it("blocks a page with no H1", () => {
    assert.deepEqual(summary(withRule(findings, "h1-missing")), [
      "block h1-missing /no-h1/",
    ]);
  });

  it("warns on an H2 followed by an H4", () => {
    const found = withRule(findings, "heading-skip");
    assert.deepEqual(summary(found), ["warn heading-skip /skip/"]);
    assert.match(found[0].selector, /h4/);
    assert.match(found[0].message, /H4 straight after an H2/);
  });

  it("reports nothing else", () => {
    assert.deepEqual(summary(findings), [
      "block h1-missing /no-h1/",
      "block h1-multiple /two-h1/",
      "warn heading-skip /skip/",
    ]);
  });
});

describe("titles and descriptions", () => {
  const findings = analyse("meta");

  it("gives two pages with the same description one warn finding listing both", () => {
    const merged = mergeFindings(withRule(findings, "description-duplicate"));
    assert.equal(merged.length, 1);
    assert.equal(merged[0].severity, "warn");
    assert.deepEqual(merged[0].routes, ["/a/", "/b/"]);
    assert.match(merged[0].message, /\/a\/.*\/b\//);
  });

  it("leaves noindex pages and the 404 page out of duplicate groups", () => {
    for (const f of findings.filter((f) => f.rule.endsWith("-duplicate"))) {
      assert.doesNotMatch(f.message, /noindex-dup|\/404\//);
      assert.ok(!["/noindex-dup/", "/404/"].includes(f.route));
    }
  });

  it("blocks duplicate titles, as one finding listing both pages", () => {
    const merged = mergeFindings(withRule(findings, "title-duplicate"));
    assert.equal(merged.length, 1);
    assert.equal(merged[0].severity, "block");
    assert.deepEqual(merged[0].routes, ["/f/", "/g/"]);
  });

  it("groups duplicate titles by the shared title, not by a page or component", () => {
    const found = withRule(findings, "title-duplicate");
    for (const f of found) {
      assert.equal(f.component, null);
      assert.equal(f.group, "title:a shared fixture title used by two pages");
    }
    const [merged] = mergeFindings(found.toReversed());
    assert.equal(merged.component, null);
    assert.equal(
      merged.group,
      "title:a shared fixture title used by two pages",
    );
    assert.deepEqual(merged.routes, ["/f/", "/g/"]);
  });

  it("blocks a missing title", () => {
    assert.deepEqual(summary(withRule(findings, "title-missing")), [
      "block title-missing /c/",
    ]);
  });

  it("blocks a second title element in the head", () => {
    assert.deepEqual(summary(withRule(findings, "title-multiple")), [
      "block title-multiple /h/",
    ]);
  });

  it("warns on a missing description", () => {
    assert.deepEqual(summary(withRule(findings, "description-missing")), [
      "warn description-missing /d/",
    ]);
  });

  it("warns on a short title and a long description", () => {
    assert.deepEqual(summary(withRule(findings, "title-length")), [
      "warn title-length /e/",
    ]);
    assert.deepEqual(summary(withRule(findings, "description-length")), [
      "warn description-length /e/",
    ]);
    const [title] = withRule(findings, "title-length");
    assert.match(title.message, /9 characters/);
    assert.match(title.message, /30.60/);
  });
});

describe("canonical", () => {
  const findings = analyse("canonical");

  it("blocks a missing canonical", () => {
    assert.deepEqual(summary(withRule(findings, "canonical-missing")), [
      "block canonical-missing /missing/",
    ]);
  });

  it("blocks a canonical without a trailing slash", () => {
    const found = withRule(findings, "canonical-trailing-slash");
    assert.deepEqual(summary(found), [
      "block canonical-trailing-slash /no-slash/",
    ]);
    assert.match(found[0].message, /https:\/\/withotto\.app\/no-slash\//);
  });

  it("blocks a relative canonical, another origin and one with no built page", () => {
    assert.deepEqual(summary(withRule(findings, "canonical-not-absolute")), [
      "block canonical-not-absolute /relative/",
    ]);
    assert.deepEqual(summary(withRule(findings, "canonical-wrong-origin")), [
      "block canonical-wrong-origin /other-origin/",
    ]);
    assert.deepEqual(summary(withRule(findings, "canonical-unresolved")), [
      "block canonical-unresolved /unresolved/",
    ]);
  });

  it("reports nothing else", () => {
    assert.equal(findings.length, 5);
  });
});

describe("internal links", () => {
  const findings = analyse("links");
  const slash = withRule(findings, "link-trailing-slash");
  const legacy = withRule(findings, "link-legacy");

  it("blocks a link to /capture, with a selector and snippet", () => {
    const found = slash.find((f) => f.snippet?.includes('href="/capture"'));
    assert.ok(found, "expected a finding for /capture");
    assert.equal(found.severity, "block");
    assert.equal(found.route, "/");
    assert.match(found.selector, /a/);
    assert.match(found.message, /\/capture\//);
  });

  it("judges same-origin absolute links and strips the query string", () => {
    const hrefs = slash.map((f) => f.snippet.match(/href="([^"]+)"/)[1]).sort();
    assert.deepEqual(hrefs, [
      "/capture",
      "/capture?a=1",
      "/contact",
      "/contact",
      "https://withotto.app/capture",
    ]);
  });

  it("passes a file download, mailto, tel, fragments and external links", () => {
    for (const f of findings) {
      assert.doesNotMatch(
        f.snippet ?? "",
        /pricing\.xlsx|mailto:|tel:|#section|example\.com|\?a=1#b/,
      );
    }
  });

  it("blocks links to /business/ and /business as legacy, not as a missing slash", () => {
    assert.equal(legacy.length, 2);
    for (const f of legacy) {
      assert.equal(f.severity, "block");
      assert.match(f.message, /\/capture\//);
    }
    assert.ok(!slash.some((f) => f.snippet.includes("/business")));
  });

  it("merges the same bad footer link across pages under the footer component", () => {
    const footer = mergeFindings(slash).filter((f) => f.component !== null);
    assert.equal(footer.length, 1);
    assert.equal(footer[0].component, "footer");
    assert.equal(footer[0].source, "src/components/footer.astro");
    assert.deepEqual(footer[0].routes, ["/", "/capture/"]);
  });
});

describe("parseRedirects", () => {
  const rules = parseRedirects(
    `# comment
https://old.example.com/* https://withotto.app/:splat 301!

/business /bank-reconciliation/ 301
/trial /bank-reconciliation/#start-a-trial 301!
/api/* https://example.com/api/:splat 200
/plain /somewhere/
`,
  );

  it("skips comments, blank lines and host rules", () => {
    assert.deepEqual(
      rules.map((r) => r.source),
      ["/business", "/trial", "/api/*", "/plain"],
    );
  });

  it("parses a target with a fragment and a forced status", () => {
    const trial = rules.find((r) => r.source === "/trial");
    assert.equal(trial.targetPath, "/bank-reconciliation/");
    assert.equal(trial.target, "/bank-reconciliation/#start-a-trial");
    assert.equal(trial.status, 301);
    assert.equal(trial.forced, true);
    assert.equal(trial.line, 5);
  });

  it("defaults the status to 301 and treats 200 as a rewrite", () => {
    assert.equal(rules.find((r) => r.source === "/plain").status, 301);
    const api = rules.find((r) => r.source === "/api/*");
    assert.equal(api.status, 200);
    assert.equal(api.isRedirect, false);
  });

  it("matches a source with or without its trailing slash", () => {
    const business = rules.find((r) => r.source === "/business");
    assert.ok(business.matches("/business/"));
    assert.ok(business.matches("/business"));
    assert.ok(!business.matches("/business-plan/"));
    assert.ok(rules.find((r) => r.source === "/api/*").matches("/api/x/y"));
  });
});

describe("redirects", () => {
  const findings = analyse("redirects");

  it("warns, not blocks, when a redirect source has a built page", () => {
    const shadowed = withRule(findings, "redirect-shadowed");
    assert.deepEqual(summary(shadowed), ["warn redirect-shadowed /old-page/"]);
    assert.match(shadowed[0].message, /never fires/);
  });

  it("does not treat a forced redirect as shadowed", () => {
    assert.ok(!findings.some((f) => f.route === "/forced-page/"));
  });

  it("warns on a redirect whose target has no built page", () => {
    assert.deepEqual(summary(withRule(findings, "redirect-target-missing")), [
      "warn redirect-target-missing /gone/",
    ]);
  });

  it("does not block a link to a shadowed source, but does to a forced one", () => {
    assert.deepEqual(summary(findings.filter((f) => f.severity === "block")), [
      "block link-legacy /",
    ]);
  });
});

describe("orphans and the sitemap", () => {
  const findings = analyse("orphans");

  it("blocks an unlinked page even though it is in the sitemap", () => {
    const orphans = withRule(findings, "orphan-page");
    assert.deepEqual(summary(orphans), [
      "block orphan-page /orphan/",
      "block orphan-page /self-linked/",
    ]);
    assert.match(
      orphans.find((f) => f.route === "/orphan/").message,
      /in the sitemap/,
    );
  });

  it("exempts the home page, noindex pages and the 404 page", () => {
    const routes = withRule(findings, "orphan-page").map((f) => f.route);
    for (const route of ["/", "/noindex/", "/404/"]) {
      assert.ok(!routes.includes(route), route);
    }
  });

  it("blocks a sitemap URL with no built page", () => {
    assert.deepEqual(summary(withRule(findings, "sitemap-url-missing")), [
      "block sitemap-url-missing /ghost/",
    ]);
  });

  it("warns on an indexable page missing from the sitemap, and a noindex page in it", () => {
    assert.deepEqual(summary(withRule(findings, "sitemap-page-missing")), [
      "warn sitemap-page-missing /not-in-sitemap/",
    ]);
    assert.deepEqual(summary(withRule(findings, "sitemap-noindex")), [
      "warn sitemap-noindex /noindex-listed/",
    ]);
  });

  it("blocks an indexable 404 page", () => {
    assert.deepEqual(summary(withRule(findings, "not-found-indexable")), [
      "block not-found-indexable /404/",
    ]);
  });
});

describe("an unreadable sitemap", () => {
  const withIndex = (sitemapIndex) =>
    analyseSite({ ...fixtureConfig("sitemap"), sitemapIndex });
  const blocking = (findings) => findings.filter((f) => f.severity === "block");

  it("passes an index whose children all resolve", () => {
    assert.deepEqual(summary(withIndex("sitemap-index.xml")), []);
  });

  it("blocks an index naming a child sitemap that was not built", () => {
    const findings = withIndex("sitemap-index-missing-child.xml");
    const found = withRule(findings, "sitemap-unreadable");
    assert.deepEqual(summary(blocking(findings)), [
      "block sitemap-unreadable /",
    ]);
    assert.equal(found[0].distFile, "dist/sitemap-index-missing-child.xml");
    assert.match(found[0].message, /sitemap-9\.xml/);
    assert.match(found[0].message, /does not exist/);
  });

  it("blocks a child sitemap that is not a sitemap", () => {
    const findings = withIndex("sitemap-index-unparseable-child.xml");
    const found = withRule(findings, "sitemap-unreadable");
    assert.deepEqual(summary(blocking(findings)), [
      "block sitemap-unreadable /",
    ]);
    assert.equal(found[0].distFile, "dist/sitemap-html.xml");
    assert.match(found[0].message, /<urlset>/);
  });

  it("blocks an index that is not a sitemap", () => {
    const findings = withIndex("sitemap-index-garbage.xml");
    assert.deepEqual(summary(blocking(findings)), [
      "block sitemap-unreadable /",
    ]);
    assert.equal(
      withRule(findings, "sitemap-unreadable")[0].distFile,
      "dist/sitemap-index-garbage.xml",
    );
  });

  it("blocks a child sitemap on another origin", () => {
    const findings = withIndex("sitemap-index-off-origin.xml");
    const found = withRule(findings, "sitemap-unreadable");
    assert.deepEqual(summary(blocking(findings)), [
      "block sitemap-unreadable /",
    ]);
    assert.match(found[0].message, /https:\/\/example\.com\/sitemap-1\.xml/);
    assert.match(found[0].message, /https:\/\/withotto\.app/);
  });

  it("blocks a child sitemap location that is not a URL", () => {
    const findings = withIndex("sitemap-index-bad-loc.xml");
    const found = withRule(findings, "sitemap-unreadable");
    assert.deepEqual(summary(blocking(findings)), [
      "block sitemap-unreadable /",
    ]);
    assert.match(found[0].message, /not-a-host/);
  });

  it("blocks an index with no child sitemaps, and a child with no URLs", () => {
    for (const index of [
      "sitemap-index-no-children.xml",
      "sitemap-index-empty-child.xml",
    ]) {
      const findings = withIndex(index);
      assert.deepEqual(summary(blocking(findings)), ["block sitemap-empty /"]);
      assert.equal(
        withRule(findings, "sitemap-empty")[0].distFile,
        `dist/${index}`,
      );
    }
  });

  it("does not bury the blocker under a warning per page", () => {
    for (const index of [
      "sitemap-index-missing-child.xml",
      "sitemap-index-no-children.xml",
    ]) {
      assert.deepEqual(
        withRule(withIndex(index), "sitemap-page-missing"),
        [],
        index,
      );
    }
  });

  it("still blocks a missing index as sitemap-missing", () => {
    assert.deepEqual(summary(withIndex("sitemap-index-nope.xml")), [
      "block sitemap-missing /",
    ]);
  });
});

describe("validateJsonLd", () => {
  it("accepts an object, an array of objects and a @graph", () => {
    assert.deepEqual(
      validateJsonLd('{"@context":"https://schema.org","@type":"Thing"}'),
      [],
    );
    assert.deepEqual(
      validateJsonLd(
        '[{"@context":"https://schema.org","@type":"A"},{"@context":"https://schema.org","@type":["B","C"]}]',
      ),
      [],
    );
    assert.deepEqual(
      validateJsonLd(
        '{"@context":"https://schema.org","@graph":[{"@type":"A"},{"@type":"B"}]}',
      ),
      [],
    );
  });

  it("reports unparseable JSON and missing fields", () => {
    assert.match(validateJsonLd("{")[0], /not valid JSON/);
    assert.match(validateJsonLd('{"@type":"A"}')[0], /@context/);
    assert.match(
      validateJsonLd('{"@context":"https://schema.org"}')[0],
      /@type/,
    );
    assert.match(validateJsonLd("[]")[0], /empty/);
    assert.match(validateJsonLd('"text"')[0], /object/);
    assert.match(
      validateJsonLd('{"@context":"https://schema.org","@graph":[{"a":1}]}')[0],
      /@graph item 1.*@type/,
    );
  });
});

describe("JSON-LD", () => {
  const findings = analyse("jsonld");

  it("blocks every invalid block and passes the valid one", () => {
    assert.deepEqual(summary(findings), [
      "block jsonld-invalid /array/",
      "block jsonld-invalid /broken-json/",
      "block jsonld-invalid /empty/",
      "block jsonld-invalid /graph/",
      "block jsonld-invalid /no-context/",
      "block jsonld-invalid /no-type/",
    ]);
    for (const f of findings) {
      assert.equal(f.selector, 'head > script[type="application/ld+json"]');
    }
  });
});

describe("page filter", () => {
  it("rejects a page filter naming a page that was not built", () => {
    assert.throws(
      () => analyseSite(fixtureConfig("meta"), ["/b/", "/nope/"]),
      /No built page for \/nope\//,
    );
  });

  it("accepts a page filter naming built pages", () => {
    assert.deepEqual(
      analyseSite(fixtureConfig("meta"), ["/b/"]),
      analyse("meta"),
    );
  });

  it("still finds duplicates against unfiltered pages, and reports only the filtered page", (t) => {
    t.mock.method(console, "log", () => {});
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    delete process.env.GITHUB_STEP_SUMMARY;
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "seo-check-"));
    try {
      const config = {
        ...baseConfig,
        root: tmp,
        abs: (p) => path.resolve(tmp, p),
      };
      const findings = analyse("meta");
      const code = finishRun({
        check: "seo",
        findings,
        pages: ["/b/"],
        config,
      });
      const report = JSON.parse(
        fs.readFileSync(path.join(tmp, ".checks", "seo.json"), "utf8"),
      );
      assert.equal(code, 0);
      assert.deepEqual(report.pageFilter, ["/b/"]);
      assert.deepEqual(
        report.findings.map((f) => [f.rule, f.routes]),
        [["description-duplicate", ["/b/"]]],
      );
      assert.match(report.findings[0].message, /\/a\//);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
      if (summaryFile !== undefined)
        process.env.GITHUB_STEP_SUMMARY = summaryFile;
    }
  });
});
