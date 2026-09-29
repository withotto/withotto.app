/**
 * Accessibility check: runs axe-core against every built page in a real
 * browser and reports WCAG 2.2 AA failures in the shared finding shape.
 *
 * Severity policy:
 * - serious and critical WCAG violations block;
 * - moderate and minor WCAG violations warn;
 * - best-practice rules (landmarks, regions, heading order) always warn.
 *
 * The check serves `dist/` with Astro's programmatic `preview()` on its own
 * fixed port and stops that server when it finishes, including on failure.
 * It never uses `astro preview --background`, which reuses a preview already
 * running for the project, so stopping it would stop Stuart's server too.
 *
 * Usage: node scripts/checks/a11y.mjs [--page /route/ ...]
 */
import net from "node:net";
import AxeBuilder from "@axe-core/playwright";
import { preview } from "astro";
import { chromium } from "playwright";
import { loadConfig } from "./lib/config.mjs";
import { componentFor, createFinding } from "./lib/findings.mjs";
import {
  assertPagesBuilt,
  finishRun,
  listPages,
  parseCheckArgs,
  runMain,
} from "./lib/run.mjs";
import { loadRouteSources, routeToSource } from "./lib/source-map.mjs";

const CHECK = "a11y";

/** WCAG 2.0, 2.1 and 2.2 at levels A and AA. */
export const WCAG_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22a",
  "wcag22aa",
];

const BEST_PRACTICE = "best-practice";
const BLOCKING_IMPACTS = new Set(["serious", "critical"]);
const SNIPPET_LENGTH = 300;
const HOST = "127.0.0.1";

/**
 * True when the URL's host is one of `hosts` or a subdomain of one.
 *
 * @param {string} url
 * @param {string[]} hosts
 */
export function isBlockedHost(url, hosts) {
  let hostname;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (hostname === "") return false;
  return hosts.some((host) => {
    const h = host.toLowerCase();
    return hostname === h || hostname.endsWith(`.${h}`);
  });
}

/**
 * True when something accepts connections on the port, on either loopback
 * address. A connect probe rather than a trial bind: macOS lets a process bind
 * 127.0.0.1 while another holds the wildcard address, and a preview bound to
 * ::1 alone would not clash with ours on 127.0.0.1 at all, yet a browser
 * asking for "localhost" could reach either.
 *
 * @param {number} port
 */
export async function isPortInUse(port) {
  const probes = ["127.0.0.1", "::1"].map(
    (host) =>
      new Promise((resolve) => {
        const socket = net.connect({ port, host });
        socket.setTimeout(1000);
        socket.once("connect", () => {
          socket.destroy();
          resolve(true);
        });
        socket.once("timeout", () => {
          socket.destroy();
          resolve(false);
        });
        socket.once("error", () => resolve(false));
      }),
  );
  return (await Promise.all(probes)).some(Boolean);
}

/**
 * Starts Astro's static preview server on exactly this port. `strictPort`
 * makes Vite fail rather than quietly move to the next free port.
 */
async function startPreview({
  astroRoot,
  astroConfigFile,
  distDir,
  port,
  logLevel,
}) {
  /** @type {Record<string, unknown>} */
  const inline = {
    root: astroRoot,
    outDir: distDir,
    logLevel,
    server: { host: HOST, port },
    vite: { preview: { strictPort: true } },
  };
  if (astroConfigFile !== undefined) inline.configFile = astroConfigFile;
  try {
    return await preview(inline);
  } catch (error) {
    if (/already in use|EADDRINUSE/i.test(String(error?.message))) {
      throw portInUseError(port);
    }
    throw error;
  }
}

function portInUseError(port) {
  return new Error(
    `Port ${port} is already in use, so the a11y check cannot start its own ` +
      `preview server there. It will not reuse a server it did not start. ` +
      `Stop whatever is listening (\`lsof -nP -iTCP:${port} -sTCP:LISTEN\` shows it), ` +
      `or set a different previewPort in checks.config.mjs.`,
  );
}

/**
 * Runs axe against the built pages and returns raw findings.
 *
 * @param {object} options
 * @param {string} options.root Repo root; `distFile` and page sources are relative to it.
 * @param {string} options.distDir Absolute path to the built site.
 * @param {number} options.port Port for the check's own preview server.
 * @param {string} [options.astroRoot] Astro project root for `preview()`. Defaults to `root`.
 * @param {false | string} [options.astroConfigFile] `false` serves `distDir` without an Astro config.
 * @param {string} [options.pagesDir]
 * @param {Record<string, string>} [options.routeSources]
 * @param {string[] | null} [options.pages] Canonical routes to visit; null for all.
 * @param {import("./lib/config.mjs").ComponentRoot[]} [options.componentRoots]
 * @param {string[]} [options.blockedHosts] Hosts (and their subdomains) no request may reach.
 * @param {import("playwright").Browser} [options.browser] Shared browser; one is launched and closed when absent.
 * @param {number} [options.navigationTimeout] Milliseconds a page has to finish loading.
 * @param {"debug" | "info" | "warn" | "error" | "silent"} [options.logLevel] Astro's log level.
 * @returns {Promise<{ findings: import("./lib/findings.mjs").Finding[], pagesChecked: string[], blockedRequests: string[] }>}
 */
export async function runA11y({
  root,
  distDir,
  port,
  astroRoot = root,
  astroConfigFile,
  pagesDir = "src/pages",
  routeSources = {},
  pages = null,
  componentRoots = [],
  blockedHosts = [],
  browser: sharedBrowser,
  navigationTimeout = 30_000,
  logLevel = "warn",
}) {
  let targets = listPages(distDir, root);
  assertPagesBuilt(
    pages,
    targets.map((t) => t.route),
  );
  if (pages !== null) targets = targets.filter((t) => pages.includes(t.route));

  if (await isPortInUse(port)) throw portInUseError(port);
  const server = await startPreview({
    astroRoot,
    astroConfigFile,
    distDir,
    port,
    logLevel,
  });
  let browser = sharedBrowser;
  let context;
  try {
    browser ??= await chromium.launch();
    context = await browser.newContext({ serviceWorkers: "block" });
    context.setDefaultNavigationTimeout(navigationTimeout);

    // Aborted before any connection is opened. Chatwoot, for one, creates a
    // contact in the live sales inbox for every visitor, headless or not.
    /** @type {string[]} */
    const blockedRequests = [];
    const blocked = (url) => isBlockedHost(url.toString(), blockedHosts);
    await context.route(blocked, (route) => {
      blockedRequests.push(route.request().url());
      return route.abort("blockedbyclient");
    });
    await context.routeWebSocket(blocked, (ws) => {
      blockedRequests.push(ws.url());
      return ws.close();
    });

    const findings = [];
    const pagesChecked = [];
    for (const target of targets) {
      const page = await context.newPage();
      try {
        findings.push(
          ...(await checkPage(page, {
            url: `http://${HOST}:${port}${target.route}`,
            target,
            navigationTimeout,
            componentRoots,
            source: routeToSource(target.route, {
              root,
              pagesDir,
              routeSources,
            }),
          })),
        );
      } finally {
        await page.close().catch(() => {});
      }
      pagesChecked.push(target.route);
    }
    return { findings, pagesChecked, blockedRequests };
  } finally {
    await context?.close().catch(() => {});
    if (!sharedBrowser) await browser?.close().catch(() => {});
    // Logged, not thrown: a stop failure must not replace the error that
    // ended the run, which is the one runMain has to report.
    await server.stop().catch((/** @type {Error} */ error) => {
      console.error(
        `a11y: could not stop the preview server: ${error.message}`,
      );
    });
  }
}

/**
 * Loads one page, runs axe on it and turns every failing node into a finding.
 */
async function checkPage(
  page,
  { url, target, navigationTimeout, componentRoots, source },
) {
  let response;
  try {
    response = await page.goto(url, { waitUntil: "load" });
  } catch (error) {
    if (error?.name === "TimeoutError") {
      throw new Error(
        `${target.route} (${target.distFile}) did not finish loading within ` +
          `${navigationTimeout} ms. Look for a script that never finishes or a ` +
          `request that hangs; the check stopped here.`,
      );
    }
    throw error;
  }
  if (!response || !response.ok()) {
    throw new Error(
      `${target.route} returned HTTP ${response?.status() ?? "no response"} from the preview server.`,
    );
  }
  // Contrast is measured against the rendered glyphs, so let web fonts land,
  // but not for longer than a page may take to load: a stalled font request
  // would otherwise hang the run, since `evaluate` has no timeout of its own.
  await page.evaluate(
    (timeout) =>
      Promise.race([
        document.fonts.ready.then(() => undefined),
        new Promise((resolve) => setTimeout(resolve, timeout)),
      ]),
    navigationTimeout,
  );

  const results = await new AxeBuilder({ page })
    .withTags([...WCAG_TAGS, BEST_PRACTICE])
    // Tagged wcag22aa but disabled by default in axe-core.
    .options({ rules: { "target-size": { enabled: true } } })
    .analyze();

  const findings = [];
  for (const violation of results.violations) {
    const bestPractice = violation.tags.includes(BEST_PRACTICE);
    const placements = await page.evaluate(locateNodes, {
      targets: violation.nodes.map((node) => node.target),
      selectors: componentRoots.map((r) => r.selector),
    });
    violation.nodes.forEach((node, i) => {
      const { inside, paths } = placements[i];
      const component = componentFor(
        (selector) => inside.includes(selector),
        componentRoots,
      );
      findings.push(
        createFinding({
          check: CHECK,
          rule: violation.id,
          severity:
            !bestPractice &&
            BLOCKING_IMPACTS.has(node.impact ?? violation.impact)
              ? "block"
              : "warn",
          route: target.route,
          distFile: target.distFile,
          source: component ? component.source : source,
          selector: component
            ? (paths[component.selector] ?? formatTarget(node.target))
            : formatTarget(node.target),
          snippet: truncate(node.html, SNIPPET_LENGTH),
          message: formatMessage(violation, node),
          helpUrl: violation.helpUrl,
          component: component ? component.name : null,
        }),
      );
    });
  }
  return findings;
}

/**
 * Runs in the page. For each axe target, lists the component root selectors
 * the element sits inside and, for each, a structural selector from that
 * root down to the element.
 *
 * axe picks the shortest selector that is unique on the page, so the same
 * navbar link gets `.gap-2` on one page and `.gap-2.items-center` on another,
 * and findings that should merge across pages do not. A path of tag names
 * (with `:nth-of-type` only where siblings share a tag) depends only on the
 * component's own markup, so it is the same on every page and across
 * unrelated edits elsewhere, which also keeps baseline keys stable.
 *
 * @param {{ targets: unknown[][], selectors: string[] }} input
 */
function locateNodes({ targets, selectors }) {
  const step = (el) => {
    const tag = el.localName;
    const siblings = [...(el.parentElement?.children ?? [])].filter(
      (s) => s.localName === tag,
    );
    return siblings.length > 1
      ? `${tag}:nth-of-type(${siblings.indexOf(el) + 1})`
      : tag;
  };
  return targets.map((target) => {
    // Frames and shadow roots nest selectors; the first one names the element
    // in the top document, which is what component roots are matched against.
    const nested = target.length > 1 || Array.isArray(target[0]);
    const first = Array.isArray(target[0]) ? target[0][0] : target[0];
    const el = document.querySelector(first);
    /** @type {string[]} */
    const inside = [];
    /** @type {Record<string, string>} */
    const paths = {};
    if (!el) return { inside, paths };
    for (const selector of selectors) {
      const root = el.closest(selector);
      if (!root) continue;
      inside.push(selector);
      if (nested) continue;
      const parts = [];
      for (let node = el; node !== root; node = node.parentElement) {
        parts.unshift(step(node));
      }
      paths[selector] = [selector, ...parts].join(" > ");
    }
    return { inside, paths };
  });
}

/** Joins an axe target: frames with " >> ", shadow roots with " >>> ". */
function formatTarget(target) {
  return target
    .map((part) => (Array.isArray(part) ? part.join(" >>> ") : part))
    .join(" >> ");
}

function truncate(text, length) {
  if (!text) return null;
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > length ? `${flat.slice(0, length - 1)}…` : flat;
}

/**
 * A message that is fixable without opening the rule docs: the rule's
 * summary, its impact, and axe's own account of what failed on this node.
 * Colour contrast leads with the measured ratio and colours.
 */
function formatMessage(violation, node) {
  const impact = node.impact ?? violation.impact ?? "unknown";
  const head = `${violation.help} (${impact}).`;

  if (
    violation.id === "color-contrast" ||
    violation.id === "color-contrast-enhanced"
  ) {
    const data = [...node.any, ...node.all, ...node.none].find(
      (check) => check.data && check.data.contrastRatio !== undefined,
    )?.data;
    if (data && data.contrastRatio) {
      const weight =
        Number(data.fontWeight) >= 700 || data.fontWeight === "bold"
          ? "bold"
          : "normal";
      return (
        `${head} Measured ${data.contrastRatio}:1, foreground ${data.fgColor} ` +
        `on background ${data.bgColor} (${data.fontSize}, ${weight}); ` +
        `needs ${data.expectedContrastRatio}.`
      );
    }
  }

  const detail = (node.failureSummary ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !/^Fix (any|all) of the following:$/.test(line))
    .join(" ");
  return detail ? `${head} ${detail}` : head;
}

async function main() {
  const { pages } = parseCheckArgs();
  const config = await loadConfig();
  const port = config.previewPort;
  const { findings, pagesChecked, blockedRequests } = await runA11y({
    root: config.root,
    distDir: config.abs(config.distDir),
    port,
    pagesDir: config.pagesDir,
    routeSources: loadRouteSources(config),
    pages,
    componentRoots: config.componentRoots,
    blockedHosts: config.blockedHosts,
  });
  console.log(
    `a11y: checked ${pagesChecked.length} page(s); blocked ${blockedRequests.length} request(s) to ${config.blockedHosts.join(", ")}.`,
  );
  return finishRun({ check: CHECK, findings, pages, config });
}

runMain(import.meta.url, CHECK, main);
