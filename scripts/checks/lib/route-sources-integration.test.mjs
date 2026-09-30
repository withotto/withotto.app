import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import routeSources, {
  ROUTE_SOURCES_FILE,
} from "./route-sources-integration.mjs";
import { ROUTE_SOURCES_OUTPUT } from "./source-map.mjs";

function build(root, { emitMap }) {
  const dist = path.join(root, "dist");
  fs.mkdirSync(dist, { recursive: true });
  if (emitMap)
    fs.writeFileSync(
      path.join(dist, ROUTE_SOURCES_FILE),
      '{"/blog/a/":"src/a.md"}',
    );
  const integration = routeSources({ outputDir: ".checks" });
  integration.hooks["astro:config:done"]({
    config: { root: pathToFileURL(`${root}/`) },
  });
  integration.hooks["astro:build:done"]({ dir: pathToFileURL(`${dist}/`) });
}

describe("route-sources integration", () => {
  it("moves the map out of dist/ into the checks output folder", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "checks-"));
    try {
      build(root, { emitMap: true });
      assert.equal(
        fs.existsSync(path.join(root, "dist", ROUTE_SOURCES_FILE)),
        false,
      );
      assert.deepEqual(
        JSON.parse(
          fs.readFileSync(
            path.join(root, ".checks", ROUTE_SOURCES_OUTPUT),
            "utf8",
          ),
        ),
        { "/blog/a/": "src/a.md" },
      );
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });

  it("removes a stale map when a build emits none", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "checks-"));
    try {
      build(root, { emitMap: true });
      build(root, { emitMap: false });
      assert.equal(
        fs.existsSync(path.join(root, ".checks", ROUTE_SOURCES_OUTPUT)),
        false,
      );
    } finally {
      fs.rmSync(root, { recursive: true });
    }
  });
});
