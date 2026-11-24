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

describe("remapArgs with the site's repo", () => {
  const args = remapArgs("https://example.test", "/work/My Site/dist", {
    url: "https://github.com/example/site",
    root: "/work/My Site",
  });
  const rule = args.find((arg) => arg.startsWith("^https://github"));
  const pattern = new RegExp(/** @type {string} */ (rule).split(" ")[0]);

  it("points the repo's blob/main/ URLs at the working tree", () => {
    assert.equal(
      rule,
      "^https://github\\.com/example/site/blob/main/([A-Za-z0-9._/-]+)$ file:///work/My%20Site/$1",
    );
    assert.equal(args[args.indexOf(rule) - 1], "--remap");
  });

  it("leaves another repository's URLs to lychee", () => {
    for (const url of [
      "https://github.com/example/other/blob/main/README.md",
      "https://github.com/example/site-fork/blob/main/README.md",
      "https://github.com/example/site/blob/dev/README.md",
    ]) {
      assert.equal(pattern.test(url), false, url);
    }
  });

  it("leaves a percent-encoded path to lychee, so it can't decode out of the repo", () => {
    assert.equal(
      pattern.test(
        "https://github.com/example/site/blob/main/src/content/competitors/example.yaml",
      ),
      true,
    );
    for (const url of [
      "https://github.com/example/site/blob/main/%2E%2E%2Foutside.txt",
      "https://github.com/example/site/blob/main/a%20b.yaml",
    ]) {
      assert.equal(pattern.test(url), false, url);
    }
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
     * @param {Record<string, string>} [repoFiles] Paths under the repo root,
     *   outside dist/, and their contents.
     */
    function check(files, repoFiles = {}) {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), "links-test-"));
      try {
        const dist = path.join(root, "dist");
        for (const [name, content] of Object.entries(files)) {
          fs.mkdirSync(path.dirname(path.join(dist, name)), {
            recursive: true,
          });
          fs.writeFileSync(path.join(dist, name), content);
        }
        for (const [name, content] of Object.entries(repoFiles)) {
          fs.mkdirSync(path.dirname(path.join(root, name)), {
            recursive: true,
          });
          fs.writeFileSync(path.join(root, name), content);
        }
        const args = lycheeArgs(
          {
            site: "https://example.test",
            distDir: "dist",
            repoUrl: "https://github.com/example/site",
            root,
          },
          dist,
        );
        const result = spawnSync("lychee", ["--offline", ...args], {
          cwd: root,
          encoding: "utf8",
        });
        return {
          status: result.status,
          output: `${result.stdout}${result.stderr}`,
        };
      } finally {
        fs.rmSync(root, { recursive: true, force: true });
      }
    }

    it("fails a link to a section whose own page is gone", () => {
      const { status, output } = check({
        "index.html": '<a href="https://example.test/capture/">Capture</a>',
        "capture/xero/index.html": "<p>Xero</p>",
      });
      // lychee exits 2 for broken links; anything else is a different failure.
      assert.equal(status, 2, output);
    });

    const dataFileLink =
      '<a href="https://github.com/example/site/blob/main/src/content/competitors/fictional.yaml">Data file</a>';

    it("passes a link to a file of the repo that is in the working tree", () => {
      const { status, output } = check(
        { "index.html": dataFileLink },
        { "src/content/competitors/fictional.yaml": "name: Fictional\n" },
      );
      assert.equal(status, 0, output);
    });

    it("fails a link to a file of the repo that is not in the working tree", () => {
      const { status, output } = check({ "index.html": dataFileLink });
      assert.equal(status, 2, output);
    });

    it("passes a fragment link to a heading on the site's own page", () => {
      const { status, output } = check({
        "index.html":
          '<a href="https://example.test/capture/#pricing">Pricing</a>',
        "capture/index.html": '<h2 id="pricing">Pricing</h2>',
      });
      assert.equal(status, 0, output);
    });
  },
);
