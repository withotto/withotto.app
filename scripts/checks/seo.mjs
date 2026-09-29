/**
 * SEO check over the built site (R5, KTD4 in the website content system
 * plan). Reads every HTML page in `dist/`, plus the sitemap and `_redirects`,
 * and reports titles and descriptions, canonicals, heading structure, JSON-LD,
 * orphan pages, internal link form and links to legacy redirects.
 *
 * The analysis always covers the whole site, because uniqueness and orphans
 * need every page; `--page` only limits what `finishRun` reports.
 *
 * Usage: node scripts/checks/seo.mjs [--page /capture/ ...]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import { loadConfig } from "./lib/config.mjs";
import { componentFor, createFinding } from "./lib/findings.mjs";
import {
  canonicalRoute,
  finishRun,
  listPages,
  parseCheckArgs,
} from "./lib/run.mjs";
import { readRouteSources, routeToSource } from "./lib/source-map.mjs";

const CHECK = "seo";

const TITLE_RANGE = [30, 60];
const DESCRIPTION_RANGE = [70, 160];
const SNIPPET_LENGTH = 200;

/** @param {string | undefined | null} text */
function clean(text) {
  if (text === undefined || text === null) return null;
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Reads the head fields and H1s. Title and meta come from the head only,
 * because astro-navbar renders an SVG `<title>` inside the body.
 *
 * @param {import("cheerio").CheerioAPI} $
 */
function readHead($) {
  const titles = $("head > title")
    .map((_, el) => clean($(el).text()) ?? "")
    .get();
  const canonicals = $('head > link[rel~="canonical" i]')
    .map((_, el) => $(el).attr("href") ?? "")
    .get();
  const h1s = $("body h1")
    .filter((_, el) => $(el).closest("template").length === 0)
    .map((_, el) => clean($(el).text()) ?? "")
    .get();
  return {
    title: titles.length > 0 ? titles[0] : null,
    titles,
    description: clean(
      $('head > meta[name="description" i]').first().attr("content"),
    ),
    canonical: canonicals.length > 0 ? canonicals[0].trim() : null,
    canonicals,
    robots: clean($('head > meta[name="robots" i]').first().attr("content")),
    h1s,
  };
}

/**
 * Extracts the title, description, canonical, robots and H1s from a page, for
 * checks and briefs that need them without the rest of the analysis.
 *
 * @param {string} html
 * @returns {{ title: string | null, titles: string[], description: string | null, canonical: string | null, canonicals: string[], robots: string | null, h1s: string[] }}
 */
export function extractHead(html) {
  return readHead(cheerio.load(html));
}

/** @param {string | null} robots */
function isNoindex(robots) {
  return robots !== null && /\b(noindex|none)\b/i.test(robots);
}

/**
 * Validates one `application/ld+json` block.
 *
 * Accepts an object with `@context` and `@type`, an array of such objects,
 * or an object with `@context` and a `@graph` whose every node has `@type`.
 *
 * @param {string} text
 * @returns {string[]} Problems, empty when valid.
 */
export function validateJsonLd(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return [`is not valid JSON (${/** @type {Error} */ (error).message})`];
  }
  const hasContext = (/** @type {any} */ node) =>
    (typeof node["@context"] === "string" && node["@context"] !== "") ||
    (typeof node["@context"] === "object" && node["@context"] !== null);
  const hasType = (/** @type {any} */ node) =>
    (typeof node["@type"] === "string" && node["@type"] !== "") ||
    (Array.isArray(node["@type"]) &&
      node["@type"].length > 0 &&
      node["@type"].every((t) => typeof t === "string" && t !== ""));
  const isObject = (/** @type {unknown} */ v) =>
    typeof v === "object" && v !== null && !Array.isArray(v);

  /** @param {any} node @param {string} label */
  const checkNode = (node, label) => {
    if (!isObject(node)) return [`${label} is not a JSON object`];
    const problems = [];
    if (!hasContext(node)) problems.push(`${label} has no "@context"`);
    if ("@graph" in node) {
      const graph = Array.isArray(node["@graph"])
        ? node["@graph"]
        : [node["@graph"]];
      if (graph.length === 0) problems.push(`${label} has an empty "@graph"`);
      graph.forEach((item, i) => {
        if (!isObject(item)) {
          problems.push(`@graph item ${i + 1} is not a JSON object`);
        } else if (!hasType(item)) {
          problems.push(`@graph item ${i + 1} has no "@type"`);
        }
      });
    } else if (!hasType(node)) {
      problems.push(`${label} has no "@type"`);
    }
    return problems;
  };

  if (Array.isArray(data)) {
    if (data.length === 0) return ["is an empty array"];
    return data.flatMap((item, i) => checkNode(item, `item ${i + 1}`));
  }
  if (!isObject(data)) return ["is not a JSON object or array of objects"];
  return checkNode(data, "the block");
}

/**
 * @typedef {object} RedirectRule
 * @property {number} line      1-based line in `_redirects`.
 * @property {string} source    As written, e.g. "/business".
 * @property {string} target    As written, e.g. "/bank-reconciliation/#start-a-trial".
 * @property {string | null} targetPath  Target path on this site, without
 *   query or fragment; null for an external target.
 * @property {number} status
 * @property {boolean} forced   Status carries "!", so it fires even when a
 *   file exists at the source.
 * @property {boolean} isRedirect  3xx; a 200 rewrite or a 404 rule is not.
 * @property {(pathname: string) => boolean} matches  Whether a link path hits
 *   this rule, ignoring a trailing slash on either side.
 */

/** @param {string} pathname */
function stripSlash(pathname) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

/**
 * Parses Netlify `_redirects`. Host rules (a full-URL source) are skipped,
 * since they never match a path on this site.
 *
 * @param {string} text
 * @param {string} [site] This site's origin, to recognise absolute targets on it.
 * @returns {RedirectRule[]}
 */
export function parseRedirects(text, site = "https://withotto.app") {
  const origin = new URL(site).origin;
  /** @type {RedirectRule[]} */
  const rules = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) return;
    const tokens = line.split(/\s+/);
    const source = tokens[0];
    if (/^([a-z]+:)?\/\//i.test(source)) return;
    // Query-parameter conditions (key=value) sit between source and target.
    let i = 1;
    while (
      i < tokens.length &&
      tokens[i].includes("=") &&
      !tokens[i].startsWith("/") &&
      !/^[a-z]+:\/\//i.test(tokens[i])
    )
      i += 1;
    const target = tokens[i];
    if (target === undefined) return;
    const statusToken = tokens[i + 1];
    const statusMatch = statusToken?.match(/^(\d{3})(!?)$/);
    const status = statusMatch ? Number(statusMatch[1]) : 301;
    const forced = statusMatch ? statusMatch[2] === "!" : false;

    let targetPath = null;
    try {
      const url = new URL(target, origin);
      if (url.origin === origin) targetPath = url.pathname;
    } catch {
      targetPath = null;
    }

    const pattern = new RegExp(
      `^${stripSlash(source)
        .split("/")
        .map((segment) =>
          segment === "*"
            ? ".*"
            : segment.startsWith(":")
              ? "[^/]+"
              : segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        )
        .join("/")}$`,
    );

    rules.push({
      line: index + 1,
      source,
      target,
      targetPath,
      status,
      forced,
      isRedirect: status >= 300 && status < 400,
      matches: (pathname) => pattern.test(stripSlash(pathname)),
    });
  });
  return rules;
}

/** Whether a path's last segment looks like a file, e.g. "pricing.xlsx". */
function isFilePath(/** @type {string} */ pathname) {
  const last = pathname.split("/").pop() ?? "";
  return /\.[a-z0-9]+$/i.test(last);
}

/** Route a same-site path lands on, or null for a file download. */
function pathToRoute(/** @type {string} */ pathname) {
  if (isFilePath(pathname)) return null;
  return canonicalRoute(pathname);
}

/**
 * A reasonably unique CSS path to an element: from the nearest ancestor with
 * a unique id, else from the component root (so the same footer link has the
 * same selector on every page), else from `body`.
 *
 * @param {import("cheerio").CheerioAPI} $
 * @param {any} el
 * @param {{ selector: string, element: any } | null} stop
 */
function cssPath($, el, stop) {
  const parts = [];
  let node = el;
  while (node && node.type === "tag") {
    if (stop && node === stop.element) {
      parts.unshift(stop.selector);
      break;
    }
    const id = node.attribs?.id;
    if (id && /^[A-Za-z][\w-]*$/.test(id) && $(`[id="${id}"]`).length === 1) {
      parts.unshift(`#${id}`);
      break;
    }
    let part = node.tagName;
    if (node.tagName === "html") {
      parts.unshift(part);
      break;
    }
    const parent = node.parent;
    if (parent && parent.type === "tag") {
      const same = parent.children.filter(
        (/** @type {any} */ c) =>
          c.type === "tag" && c.tagName === node.tagName,
      );
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    if (node.tagName === "body" || node.tagName === "head") break;
    node = parent;
  }
  return parts.join(" > ");
}

/** @param {import("cheerio").CheerioAPI} $ @param {any} el */
function snippetOf($, el) {
  const html = ($.html(el) ?? "").replace(/\s+/g, " ").trim();
  return html.length > SNIPPET_LENGTH
    ? `${html.slice(0, SNIPPET_LENGTH - 1)}…`
    : html;
}

/** @param {string[]} items */
function listRoutes(items) {
  return items.join(", ");
}

/**
 * Reads the sitemap index (or a plain urlset) and returns every page URL.
 *
 * @param {string} distAbs
 * @param {string} indexFile Relative to dist.
 * @param {string} origin
 * @returns {{ urls: string[], files: string[] } | null} null when the index is missing.
 */
function readSitemap(distAbs, indexFile, origin) {
  const first = path.join(distAbs, indexFile);
  if (!fs.existsSync(first)) return null;
  const urls = [];
  const files = [];
  const queue = [first];
  const seen = new Set();
  while (queue.length > 0) {
    const file = /** @type {string} */ (queue.shift());
    if (seen.has(file) || !fs.existsSync(file)) continue;
    seen.add(file);
    files.push(file);
    const $ = cheerio.load(fs.readFileSync(file, "utf8"), { xml: true });
    $("sitemap > loc").each((_, el) => {
      const loc = $(el).text().trim();
      try {
        const url = new URL(loc, origin);
        if (url.origin === origin) {
          queue.push(path.join(distAbs, ...url.pathname.split("/")));
        }
      } catch {
        // An unparseable child sitemap URL is skipped.
      }
    });
    $("url > loc").each((_, el) => {
      urls.push($(el).text().trim());
    });
  }
  return { urls, files };
}

/**
 * Analyses the built site and returns every finding, for every page.
 *
 * @param {Awaited<ReturnType<typeof loadConfig>>} config
 * @returns {import("./lib/findings.mjs").Finding[]}
 */
export function analyseSite(config) {
  const distAbs = config.abs(config.distDir);
  const origin = new URL(config.site).origin;
  const roots = config.componentRoots ?? [];
  const routeSources = readRouteSources(
    path.join(config.abs(config.outputDir), "route-sources.json"),
  );
  const sourceOf = (/** @type {string} */ route) =>
    routeToSource(route, {
      root: config.root,
      pagesDir: config.pagesDir,
      routeSources,
    });
  const rel = (/** @type {string} */ abs) =>
    path.relative(config.root, abs).split(path.sep).join("/");

  /** @type {import("./lib/findings.mjs").Finding[]} */
  const findings = [];
  const add = (/** @type {any} */ fields) =>
    findings.push(createFinding({ check: CHECK, ...fields }));

  const redirectsAbs = config.abs(config.redirectsFile);
  const redirects = fs.existsSync(redirectsAbs)
    ? parseRedirects(fs.readFileSync(redirectsAbs, "utf8"), config.site)
    : [];

  const pages = listPages(distAbs, config.root).map((page) => {
    const html = fs.readFileSync(path.join(config.root, page.distFile), "utf8");
    const $ = cheerio.load(html);
    const head = readHead($);
    const is404 =
      path.posix.relative(rel(distAbs), page.distFile) === "404.html";
    return {
      ...page,
      $,
      head,
      is404,
      noindex: isNoindex(head.robots),
      source: sourceOf(page.route),
    };
  });
  const routes = new Set(pages.map((p) => p.route));

  /** Location fields for an element finding, merged under its component. */
  const at = (
    /** @type {typeof pages[number]} */ page,
    /** @type {any} */ el,
  ) => {
    const $ = page.$;
    const root = componentFor((sel) => $(el).closest(sel).length > 0, roots);
    const stop = root
      ? {
          selector: root.selector,
          element: $(el).closest(root.selector).get(0),
        }
      : null;
    return {
      route: page.route,
      distFile: page.distFile,
      source: root ? root.source : page.source,
      component: root ? root.name : null,
      selector: cssPath($, el, stop),
      snippet: snippetOf($, el),
    };
  };
  const pageAt = (/** @type {typeof pages[number]} */ page, extra = {}) => ({
    route: page.route,
    distFile: page.distFile,
    source: page.source,
    ...extra,
  });

  // Effective redirects: 3xx rules that fire, i.e. forced or not shadowed.
  const effectiveRedirects = [];
  for (const rule of redirects.filter((r) => r.isRedirect)) {
    const shadowing = rule.forced
      ? []
      : pages.filter((p) => rule.matches(p.route));
    for (const page of shadowing) {
      add({
        ...pageAt(page),
        rule: "redirect-shadowed",
        severity: "warn",
        message: `${config.redirectsFile} line ${rule.line} redirects ${rule.source} to ${rule.target}, but ${page.distFile} exists, so Netlify serves the page and the redirect never fires. If the page was retired, delete its source (${page.source}); if it is live, remove the redirect line; to redirect anyway, force it with "${rule.status}!".`,
      });
    }
    if (shadowing.length === 0) effectiveRedirects.push(rule);

    if (
      rule.targetPath !== null &&
      !/[*:]/.test(rule.targetPath) &&
      !isFilePath(rule.targetPath) &&
      !routes.has(canonicalRoute(rule.targetPath))
    ) {
      add({
        route: canonicalRoute(stripSlash(rule.source).replace(/\*$/, "")),
        distFile: config.redirectsFile,
        source: config.redirectsFile,
        rule: "redirect-target-missing",
        severity: "warn",
        message: `${config.redirectsFile} line ${rule.line} redirects ${rule.source} to ${rule.target}, but no built page exists at ${canonicalRoute(rule.targetPath)}, so visitors land on a 404. Point the redirect at a live page.`,
      });
    }
  }

  // Titles, descriptions, canonicals, headings, JSON-LD, links.
  /** @type {Map<string, Set<string>>} */
  const incoming = new Map();
  for (const page of pages) {
    const { $, head } = page;

    if (head.title === null || head.title === "") {
      add({
        ...pageAt(page, { selector: "head > title" }),
        rule: "title-missing",
        severity: "block",
        message: `Page has no <title> in its <head>. Pass a title of ${TITLE_RANGE[0]}–${TITLE_RANGE[1]} characters that names the page's topic to the layout.`,
      });
    } else {
      if (head.titles.length > 1) {
        add({
          ...pageAt(page, { selector: "head > title" }),
          rule: "title-multiple",
          severity: "block",
          message: `Page has ${head.titles.length} <title> elements in its <head> (${head.titles.map((t) => `"${t}"`).join(", ")}); browsers and search engines use only the first. Keep exactly one.`,
        });
      }
      const n = head.title.length;
      if (n < TITLE_RANGE[0] || n > TITLE_RANGE[1]) {
        add({
          ...pageAt(page, {
            selector: "head > title",
            snippet: `<title>${head.title}</title>`,
          }),
          rule: "title-length",
          severity: "warn",
          message: `Title "${head.title}" is ${n} characters; aim for ${TITLE_RANGE[0]}–${TITLE_RANGE[1]} so it is descriptive but not truncated in search results.`,
        });
      }
    }

    if (head.description === null || head.description === "") {
      add({
        ...pageAt(page, { selector: 'head > meta[name="description"]' }),
        rule: "description-missing",
        severity: "warn",
        message: `Page has no meta description. Add one of ${DESCRIPTION_RANGE[0]}–${DESCRIPTION_RANGE[1]} characters summarising the page, or search engines will pick their own snippet.`,
      });
    } else {
      const n = head.description.length;
      if (n < DESCRIPTION_RANGE[0] || n > DESCRIPTION_RANGE[1]) {
        add({
          ...pageAt(page, {
            selector: 'head > meta[name="description"]',
            snippet: `<meta name="description" content="${head.description.slice(0, SNIPPET_LENGTH - 40)}${n > SNIPPET_LENGTH - 40 ? "…" : ""}">`,
          }),
          rule: "description-length",
          severity: "warn",
          message: `Meta description is ${n} characters; aim for ${DESCRIPTION_RANGE[0]}–${DESCRIPTION_RANGE[1]} so search results show it whole.`,
        });
      }
    }

    checkCanonical(page);
    checkHeadings(page);
    checkJsonLd(page);

    $("a[href]").each((_, el) => {
      const href = ($(el).attr("href") ?? "").trim();
      if (href === "" || href.startsWith("#") || href.startsWith("?")) return;
      let url;
      try {
        url = new URL(href, `${origin}${page.route}`);
      } catch {
        return;
      }
      if (!/^https?:$/.test(url.protocol) || url.origin !== origin) return;
      const pathname = url.pathname;

      const target = pathToRoute(pathname);
      if (target !== null && target !== page.route && !page.is404) {
        if (!incoming.has(target)) incoming.set(target, new Set());
        /** @type {Set<string>} */ (incoming.get(target)).add(page.route);
      }

      const legacy = effectiveRedirects.find((r) => r.matches(pathname));
      if (legacy) {
        add({
          ...at(page, el),
          rule: "link-legacy",
          severity: "block",
          message: `Link to ${pathname} hits a redirect (${config.redirectsFile} line ${legacy.line}: ${legacy.source} → ${legacy.target}). Link to ${legacy.target} directly.`,
        });
        return;
      }
      if (
        pathname !== "/" &&
        !pathname.endsWith("/") &&
        !isFilePath(pathname)
      ) {
        add({
          ...at(page, el),
          rule: "link-trailing-slash",
          severity: "block",
          message: `Internal link to ${pathname} has no trailing slash, so it goes through a redirect (the site uses trailingSlash: "always"). Write ${pathname}/ instead.`,
        });
      }
    });
  }

  /** @param {typeof pages[number]} page */
  function checkCanonical(page) {
    const { head } = page;
    const selector = 'head > link[rel="canonical"]';
    if (head.canonical === null || head.canonical === "") {
      add({
        ...pageAt(page, { selector }),
        rule: "canonical-missing",
        severity: "block",
        message: `Page has no <link rel="canonical">. Add one pointing at ${origin}${page.route} (pass it through the layout's seo prop).`,
      });
      return;
    }
    const snippet = `<link rel="canonical" href="${head.canonical}">`;
    if (head.canonicals.length > 1) {
      add({
        ...pageAt(page, { selector, snippet }),
        rule: "canonical-multiple",
        severity: "block",
        message: `Page has ${head.canonicals.length} canonical links (${head.canonicals.join(", ")}); search engines may ignore them all. Keep exactly one.`,
      });
    }
    let url;
    try {
      url = new URL(head.canonical);
    } catch {
      add({
        ...pageAt(page, { selector, snippet }),
        rule: "canonical-not-absolute",
        severity: "block",
        message: `Canonical "${head.canonical}" is not an absolute URL. Use the full URL, e.g. ${origin}${page.route}.`,
      });
      return;
    }
    if (url.origin !== origin) {
      add({
        ...pageAt(page, { selector, snippet }),
        rule: "canonical-wrong-origin",
        severity: "block",
        message: `Canonical ${head.canonical} is not on this site (${origin}), so search engines are told to index another site instead. Point it at ${origin}${page.route} unless the page is a deliberate copy.`,
      });
      return;
    }
    const canonicalPath = url.pathname;
    if (!canonicalPath.endsWith("/") && !isFilePath(canonicalPath)) {
      add({
        ...pageAt(page, { selector, snippet }),
        rule: "canonical-trailing-slash",
        severity: "block",
        message: `Canonical ${head.canonical} has no trailing slash, so it names a URL that redirects. Use ${origin}${canonicalPath}/.`,
      });
    }
    const target = pathToRoute(canonicalPath);
    if (target === null || !routes.has(target)) {
      add({
        ...pageAt(page, { selector, snippet }),
        rule: "canonical-unresolved",
        severity: "block",
        message: `Canonical ${head.canonical} does not match any built page in ${config.distDir}/. Point it at this page (${origin}${page.route}) or another page that exists.`,
      });
    }
  }

  /** @param {typeof pages[number]} page */
  function checkHeadings(page) {
    const { $ } = page;
    const headings = $("body h1, body h2, body h3, body h4, body h5, body h6")
      .filter((_, el) => $(el).closest("template").length === 0)
      .get();
    const h1s = headings.filter((el) => el.tagName === "h1");
    if (h1s.length === 0) {
      add({
        ...pageAt(page),
        rule: "h1-missing",
        severity: "block",
        message: `Page has no <h1>. Add exactly one H1 that states the page's topic.`,
      });
    }
    const texts = page.head.h1s.map((t) => `"${t}"`).join(", ");
    for (const el of h1s.slice(1)) {
      add({
        ...at(page, el),
        rule: "h1-multiple",
        severity: "block",
        message: `Page has ${h1s.length} <h1> elements (${texts}); a page needs exactly one. Demote this one ("${clean($(el).text())}") to an <h2> or lower.`,
      });
    }
    let previous = 0;
    for (const el of headings) {
      const level = Number(el.tagName.slice(1));
      if (previous > 0 && level > previous + 1) {
        add({
          ...at(page, el),
          rule: "heading-skip",
          severity: "warn",
          message: `Heading "${clean($(el).text())}" is an H${level} straight after an H${previous}, skipping a level. Make it an H${previous + 1}, or add the missing level above it.`,
        });
      }
      previous = level;
    }
  }

  /** @param {typeof pages[number]} page */
  function checkJsonLd(page) {
    const { $ } = page;
    const blocks = $('script[type="application/ld+json" i]').get();
    blocks.forEach((el, i) => {
      const problems = validateJsonLd($(el).text());
      if (problems.length === 0) return;
      const location = at(page, el);
      const parent = el.parent;
      const scripts = parent
        ? parent.children.filter(
            (/** @type {any} */ c) =>
              c.type === "tag" && c.tagName === "script",
          )
        : [el];
      const parentPath =
        parent && parent.type === "tag" ? cssPath($, parent, null) : "";
      const nth =
        scripts.length > 1 ? `:nth-of-type(${scripts.indexOf(el) + 1})` : "";
      add({
        ...location,
        selector: `${parentPath ? `${parentPath} > ` : ""}script[type="application/ld+json"]${nth}`,
        rule: "jsonld-invalid",
        severity: "block",
        message: `JSON-LD block ${i + 1} of ${blocks.length} ${problems.join("; ")}. Every block must parse as JSON and give each item an "@context" (usually "https://schema.org") and an "@type"; an array of such items or a "@graph" is fine.`,
      });
    });
  }

  // Duplicates: one finding per page, merged into one report entry through a
  // shared group key in `component` (mergeFindings only merges component
  // findings). Noindex pages and the 404 page are left out.
  const eligible = pages.filter((p) => !p.noindex && !p.is404);
  for (const [field, rule, severity, label, selector] of [
    ["title", "title-duplicate", "block", "title", "head > title"],
    [
      "description",
      "description-duplicate",
      "warn",
      "meta description",
      'head > meta[name="description"]',
    ],
  ]) {
    /** @type {Map<string, typeof pages>} */
    const groups = new Map();
    for (const page of eligible) {
      const value = page.head[/** @type {"title" | "description"} */ (field)];
      if (!value) continue;
      const key = value.toLowerCase();
      groups.set(key, [...(groups.get(key) ?? []), page]);
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const value =
        group[0].head[/** @type {"title" | "description"} */ (field)];
      const where = group.map((p) => `${p.route} (${p.source})`);
      for (const page of group) {
        add({
          ...pageAt(page, {
            selector,
            snippet:
              value.length > SNIPPET_LENGTH
                ? `${value.slice(0, SNIPPET_LENGTH - 1)}…`
                : value,
            component: `same-${field}:${group[0].route}`,
          }),
          rule,
          severity,
          message: `${group.length} pages share the ${label} "${value}": ${listRoutes(where)}. Give each page its own ${label}.`,
        });
      }
    }
  }

  // Orphans and the sitemap.
  const sitemap = readSitemap(distAbs, config.sitemapIndex, origin);
  const sitemapRoutes = new Set();
  if (sitemap === null) {
    add({
      route: "/",
      distFile: rel(path.join(distAbs, config.sitemapIndex)),
      source: "unknown",
      rule: "sitemap-missing",
      severity: "block",
      message: `${config.distDir}/${config.sitemapIndex} does not exist, so search engines get no sitemap. Check the sitemap integration in the Astro config.`,
    });
  } else {
    const sitemapFile = rel(sitemap.files[sitemap.files.length - 1]);
    for (const loc of sitemap.urls) {
      let url;
      try {
        url = new URL(loc);
      } catch {
        url = null;
      }
      const route =
        url && url.origin === origin ? pathToRoute(url.pathname) : null;
      if (route !== null) sitemapRoutes.add(route);
      if (route === null || !routes.has(route)) {
        add({
          route: route ?? "/",
          distFile: sitemapFile,
          source: "unknown",
          rule: "sitemap-url-missing",
          severity: "block",
          message: `The sitemap lists ${loc}, but no built page exists for it, so search engines are sent to a 404 or a redirect. Remove it from the sitemap or restore the page.`,
        });
      }
    }
  }

  for (const page of pages) {
    if (page.is404) {
      if (!page.noindex) {
        add({
          ...pageAt(page, { selector: 'head > meta[name="robots"]' }),
          rule: "not-found-indexable",
          severity: "block",
          message: `The 404 page is indexable (robots: ${page.head.robots ?? "not set"}); it is reachable at ${page.route} with a 200 status and could be indexed as a thin page. Mark it noindex through the layout's seo prop.`,
        });
      }
      continue;
    }
    if (page.noindex) {
      if (sitemapRoutes.has(page.route)) {
        add({
          ...pageAt(page, { selector: 'head > meta[name="robots"]' }),
          rule: "sitemap-noindex",
          severity: "warn",
          message: `Page is marked noindex but is listed in the sitemap, which sends search engines mixed signals. Exclude it from the sitemap, or remove noindex if it should be indexed.`,
        });
      }
      continue;
    }
    const inSitemap = sitemapRoutes.has(page.route);
    if (page.route !== "/" && !incoming.has(page.route)) {
      add({
        ...pageAt(page),
        rule: "orphan-page",
        severity: "block",
        message: `No other page links to ${page.route} (it is ${inSitemap ? "in the sitemap" : "not in the sitemap either"}), so visitors and crawlers cannot reach it by browsing. Link to it from a relevant page, or mark it noindex or stop building it if it should not be public.`,
      });
    }
    if (sitemap !== null && !inSitemap) {
      add({
        ...pageAt(page),
        rule: "sitemap-page-missing",
        severity: "warn",
        message: `Indexable page ${page.route} is not in the sitemap. Include it (check the sitemap filter in the Astro config), or mark it noindex if it should not be indexed.`,
      });
    }
  }

  return findings;
}

async function main() {
  const { pages } = parseCheckArgs();
  const config = await loadConfig();
  const findings = analyseSite(config);
  process.exitCode = finishRun({ check: CHECK, findings, pages, config });
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  fs.realpathSync(process.argv[1]) ===
    fs.realpathSync(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 2;
  });
}
