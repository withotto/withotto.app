import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  distFileToRoute,
  readRouteSources,
  routeToSource,
} from "./source-map.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

describe("distFileToRoute", () => {
  it("maps index files to their directory route", () => {
    assert.equal(distFileToRoute("index.html"), "/");
    assert.equal(distFileToRoute("capture/index.html"), "/capture/");
    assert.equal(
      distFileToRoute("blog/some-post/index.html"),
      "/blog/some-post/",
    );
  });

  it("maps a top-level file to a route of its own name", () => {
    assert.equal(distFileToRoute("404.html"), "/404/");
  });
});

describe("routeToSource", () => {
  const options = { root: repoRoot, pagesDir: "src/pages" };

  it("maps dist/capture/index.html to src/pages/capture/index.astro", () => {
    const route = distFileToRoute("capture/index.html");
    assert.equal(
      routeToSource(route, options),
      "src/pages/capture/index.astro",
    );
  });

  it("maps the home page and an .mdx page", () => {
    assert.equal(routeToSource("/", options), "src/pages/index.astro");
    assert.equal(
      routeToSource("/privacy-policy/", options),
      "src/pages/privacy-policy.mdx",
    );
    assert.equal(routeToSource("/404/", options), "src/pages/404.astro");
  });

  it("maps a directory index served by a rest-parameter page", () => {
    assert.equal(
      routeToSource("/blog/", options),
      "src/pages/blog/[...page].astro",
    );
  });

  it("maps a blog post to its dated source file through the build-time map", () => {
    const routeSources = {
      "/blog/bank-rule-activity-report/":
        "src/content/blog/product-updates/2025-06-05-bank-rule-activity-report.mdx",
    };
    assert.equal(
      routeToSource("/blog/bank-rule-activity-report/", {
        ...options,
        routeSources,
      }),
      "src/content/blog/product-updates/2025-06-05-bank-rule-activity-report.mdx",
    );
  });

  it("returns unknown for a route nothing explains", () => {
    assert.equal(routeToSource("/blog/not-in-the-map/", options), "unknown");
    assert.equal(routeToSource("/no/such/page/", options), "unknown");
  });
});

describe("readRouteSources", () => {
  it("returns an empty map when the build has not written one", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "checks-"));
    try {
      assert.deepEqual(
        readRouteSources(path.join(dir, "route-sources.json")),
        {},
      );
    } finally {
      fs.rmSync(dir, { recursive: true });
    }
  });
});
