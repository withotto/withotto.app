import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { lycheeArgs, remapArgs } from "./links.mjs";

const hasLychee = spawnSync("lychee", ["--version"]).status === 0;

describe("remapArgs", () => {
  const args = remapArgs("https://example.test", "/work/My Site/dist");

  it("points the site's own pages at the build, not production", () => {
    assert.ok(
      args.includes(
        "^https://example\\.test/(.*)$ file:///work/My%20Site/dist/$1",
      ),
    );
  });

  it("maps /404/ to the built 404.html before the general rule", () => {
    const special = args.indexOf(
      "^https://example\\.test/404/$ file:///work/My%20Site/dist/404.html",
    );
    const general = args.indexOf(
      "^https://example\\.test/(.*)$ file:///work/My%20Site/dist/$1",
    );
    assert.ok(special !== -1 && special < general);
  });

  it("passes each rule after its own --remap flag", () => {
    assert.deepEqual(
      args.filter((_, i) => i % 2 === 0),
      ["--remap", "--remap"],
    );
  });
});

describe(
  "lycheeArgs against a built site",
  { skip: !hasLychee && "lychee is not installed" },
  () => {
    /**
     * Builds a dist/ holding one page that links to the site's own origin, and
     * returns lychee's exit status for it.
     *
     * @param {Record<string, string>} files Paths under dist/ and their contents.
     */
    function check(files) {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "links-test-"));
      const dist = path.join(root, "dist");
      for (const [name, content] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(dist, name)), { recursive: true });
        fs.writeFileSync(path.join(dist, name), content);
      }
      const args = lycheeArgs(
        { site: "https://example.test", distDir: "dist" },
        dist,
      );
      const result = spawnSync("lychee", ["--offline", ...args], { cwd: root });
      fs.rmSync(root, { recursive: true, force: true });
      return result.status;
    }

    it("fails a link to a section whose own page is gone", () => {
      const status = check({
        "index.html": '<a href="https://example.test/capture/">Capture</a>',
        "capture/xero/index.html": "<p>Xero</p>",
      });
      assert.notEqual(status, 0);
    });

    it("passes a fragment link to a heading on the site's own page", () => {
      const status = check({
        "index.html":
          '<a href="https://example.test/capture/#pricing">Pricing</a>',
        "capture/index.html": '<h2 id="pricing">Pricing</h2>',
      });
      assert.equal(status, 0);
    });
  },
);
