import assert from "node:assert/strict";
import net from "node:net";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { preview } from "astro";
import { chromium } from "playwright";
import { isBlockedHost, isPortInUse, runA11y } from "./a11y.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const siteDir = path.join(here, "fixtures/a11y/site");
const hangDir = path.join(here, "fixtures/a11y/hang");

const roots = [
  {
    name: "navbar",
    selector: "header",
    source: "src/components/navbar/navbar.astro",
  },
];

/** A port nothing is listening on right now. */
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = /** @type {net.AddressInfo} */ (server.address());
  await new Promise((resolve) => server.close(resolve));
  return port;
}

/** Listens on host:port until closed, standing in for someone else's server. */
async function occupy(port, host) {
  const server = net.createServer((socket) => socket.destroy());
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  return server;
}

let browser;
// Chromium resolves chat.withotto.app to this local server instead, so any
// connection the check lets through is counted here rather than reaching the
// live Chatwoot instance.
let sentinel;
let sentinelConnections = 0;

function options(overrides = {}) {
  return {
    root,
    distDir: siteDir,
    astroRoot: siteDir,
    astroConfigFile: false,
    componentRoots: roots,
    blockedHosts: ["chat.withotto.app"],
    browser,
    logLevel: "error",
    ...overrides,
  };
}

before(async () => {
  sentinel = net.createServer((socket) => {
    sentinelConnections += 1;
    socket.destroy();
  });
  await new Promise((resolve) => sentinel.listen(0, "127.0.0.1", resolve));
  const { port } = sentinel.address();
  browser = await chromium.launch({
    args: [`--host-resolver-rules=MAP chat.withotto.app 127.0.0.1:${port}`],
  });
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => sentinel.close(resolve));
});

describe("isBlockedHost", () => {
  it("matches the host exactly and its subdomains, nothing else", () => {
    const hosts = ["chat.withotto.app"];
    assert.equal(
      isBlockedHost("https://chat.withotto.app/packs/js/sdk.js", hosts),
      true,
    );
    assert.equal(
      isBlockedHost("wss://cdn.chat.withotto.app/cable", hosts),
      true,
    );
    assert.equal(isBlockedHost("https://withotto.app/", hosts), false);
    assert.equal(isBlockedHost("https://notchat.withotto.app/", hosts), false);
    assert.equal(
      isBlockedHost("https://chat.withotto.app.evil.test/", hosts),
      false,
    );
    assert.equal(isBlockedHost("data:text/plain,hi", hosts), false);
  });
});

describe("runA11y on the fixture site", () => {
  let result;
  let connectionsBefore;
  let port;

  before(async () => {
    port = await freePort();
    connectionsBefore = sentinelConnections;
    result = await runA11y(options({ port }));
  });

  const on = (route) => result.findings.filter((f) => f.route === route);

  it("visits every built page", () => {
    assert.deepEqual(result.pagesChecked, [
      "/",
      "/chat/",
      "/component-two/",
      "/component/",
      "/low-contrast/",
      "/missing-alt/",
      "/no-main/",
      "/small-target/",
    ]);
  });

  it("reports nothing on a clean page", () => {
    assert.deepEqual(on("/"), []);
  });

  it("blocks on missing alt text, a critical violation", () => {
    const [finding, ...rest] = on("/missing-alt/");
    assert.equal(rest.length, 0);
    assert.equal(finding.check, "a11y");
    assert.equal(finding.rule, "image-alt");
    assert.equal(finding.severity, "block");
    assert.equal(
      finding.distFile,
      "scripts/checks/fixtures/a11y/site/missing-alt/index.html",
    );
    assert.match(finding.message, /critical/);
    assert.match(finding.message, /alt/);
    assert.match(
      finding.helpUrl,
      /dequeuniversity\.com\/rules\/axe\/.*\/image-alt/,
    );
    assert.match(finding.selector, /img/);
    assert.match(finding.snippet, /^<img /);
    assert.equal(finding.component, null);
  });

  it("blocks on a 2.89:1 white-on-brand-green button, with the measured colours", () => {
    const [finding, ...rest] = on("/low-contrast/");
    assert.equal(rest.length, 0);
    assert.equal(finding.rule, "color-contrast");
    assert.equal(finding.severity, "block");
    assert.match(finding.message, /serious/);
    // The true ratio is 2.888; axe truncates rather than rounds.
    assert.match(finding.message, /Measured 2\.8[89]:1/);
    assert.match(finding.message, /#ffffff/);
    assert.match(finding.message, /#02ac8a/);
    assert.match(finding.message, /4\.5:1/);
  });

  it("reports a 16x16 pixel target under target-size", () => {
    const findings = on("/small-target/");
    assert.ok(findings.length > 0);
    assert.ok(
      findings.every((f) => f.rule === "target-size"),
      JSON.stringify(findings),
    );
    assert.match(findings[0].message, /target size|24/i);
  });

  it("only warns, through best-practice rules, when <main> is missing", () => {
    const findings = on("/no-main/");
    const rules = findings.map((f) => f.rule);
    assert.ok(rules.includes("landmark-one-main"), rules.join(", "));
    assert.ok(
      findings.every((f) => f.severity === "warn"),
      JSON.stringify(findings),
    );
  });

  it("attributes a finding under a component root to that component", () => {
    const findings = on("/component/");
    const inHeader = findings.find((f) => f.component === "navbar");
    const inMain = findings.find((f) => f.component === null);
    assert.equal(inHeader.rule, "image-alt");
    assert.equal(inHeader.source, "src/components/navbar/navbar.astro");
    assert.equal(inMain.rule, "image-alt");
    assert.equal(inMain.source, "unknown");
  });

  // axe picks the shortest selector unique on each page, so the same header
  // element gets different selectors on different pages and would never merge.
  it("gives a component finding the same selector on every page", () => {
    const [one, two] = ["/component/", "/component-two/"].map((route) =>
      on(route).find((f) => f.component === "navbar"),
    );
    assert.equal(one.selector, "header > a > img");
    assert.equal(two.selector, one.selector);
  });

  it("never lets a request reach chat.withotto.app", () => {
    assert.ok(
      result.blockedRequests.includes(
        "https://chat.withotto.app/packs/js/sdk.js",
      ),
      JSON.stringify(result.blockedRequests),
    );
    assert.equal(sentinelConnections - connectionsBefore, 0);
    assert.deepEqual(on("/chat/"), []);
  });

  it("stops its preview server afterwards", async () => {
    assert.equal(await isPortInUse(port), false);
  });
});

describe("runA11y options", () => {
  it("maps a page source through the route map when there is one", async () => {
    const { findings } = await runA11y(
      options({
        port: await freePort(),
        pages: ["/missing-alt/"],
        routeSources: { "/missing-alt/": "src/content/blog/missing-alt.mdx" },
      }),
    );
    assert.deepEqual(
      findings.map((f) => [f.route, f.source]),
      [["/missing-alt/", "src/content/blog/missing-alt.mdx"]],
    );
  });

  it("visits only the filtered pages", async () => {
    const { pagesChecked } = await runA11y(
      options({ port: await freePort(), pages: ["/no-main/", "/"] }),
    );
    assert.deepEqual(pagesChecked, ["/", "/no-main/"]);
  });

  it("rejects a page filter naming a page that was not built", async () => {
    await assert.rejects(
      runA11y(options({ port: await freePort(), pages: ["/nope/"] })),
      /No built page for \/nope\//,
    );
  });

  // Proves the sentinel is wired up, so a zero count above means something.
  it("would reach the chat sentinel if the host were not blocked", async () => {
    const before = sentinelConnections;
    await runA11y(
      options({ port: await freePort(), pages: ["/chat/"], blockedHosts: [] }),
    );
    assert.ok(sentinelConnections > before);
  });
});

describe("the preview server lifecycle", () => {
  it("stops the server when the run throws midway", async () => {
    const port = await freePort();
    await assert.rejects(
      runA11y(
        options({
          port,
          distDir: hangDir,
          astroRoot: hangDir,
          navigationTimeout: 1500,
        }),
      ),
      /\/stuck\/.*did not finish loading within 1500 ms/s,
    );
    assert.equal(await isPortInUse(port), false);
  });

  it("leaves a preview someone already has running untouched", async () => {
    const theirPort = await freePort();
    const theirs = await preview({
      root: siteDir,
      configFile: false,
      outDir: siteDir,
      logLevel: "error",
      server: { host: "127.0.0.1", port: theirPort },
    });
    try {
      await runA11y(options({ port: await freePort(), pages: ["/"] }));
      const response = await fetch(`http://127.0.0.1:${theirPort}/`);
      assert.equal(response.status, 200);
    } finally {
      await theirs.stop();
    }
  });

  for (const host of ["127.0.0.1", "::1"]) {
    it(`refuses a port already in use on ${host}, naming it`, async () => {
      const port = await freePort();
      const other = await occupy(port, host);
      try {
        await assert.rejects(
          runA11y(options({ port })),
          new RegExp(`Port ${port} is already in use.*previewPort`, "s"),
        );
      } finally {
        await new Promise((resolve) => other.close(resolve));
      }
    });
  }
});
