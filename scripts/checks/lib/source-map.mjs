import fs from "node:fs";
import path from "node:path";

const PAGE_EXTENSIONS = [".astro", ".mdx", ".md"];

/**
 * The build-time route map's name in the checks' output directory. Written by
 * `route-sources-integration.mjs`, read by the checks.
 */
export const ROUTE_SOURCES_OUTPUT = "route-sources.json";

/**
 * Converts a built HTML file to its canonical route: a leading and a trailing
 * slash, the same form briefs and baseline keys use.
 *
 * @param {string} distRelative Path relative to `dist/`, e.g. "capture/index.html".
 * @returns {string} e.g. "/capture/"
 */
export function distFileToRoute(distRelative) {
  const posix = distRelative.split(path.sep).join("/");
  if (posix === "index.html") return "/";
  if (posix.endsWith("/index.html")) {
    return `/${posix.slice(0, -"index.html".length)}`;
  }
  // Top-level files such as 404.html have no directory of their own.
  return `/${posix.replace(/\.html$/, "")}/`;
}

/**
 * Maps a route to the file that produces it. Static pages resolve through
 * `src/pages`; content-collection routes through the map written at build
 * time (see `route-sources-integration.mjs`), so blog slugs are never
 * re-derived here. A route neither can explain is "unknown", never dropped.
 *
 * @param {string} route Canonical route.
 * @param {object} options
 * @param {string} options.root Repo root.
 * @param {string} options.pagesDir Relative to root, e.g. "src/pages".
 * @param {Record<string, string>} [options.routeSources] Build-time map.
 * @returns {string} Source path relative to root, or "unknown".
 */
export function routeToSource(route, { root, pagesDir, routeSources = {} }) {
  if (routeSources[route]) return routeSources[route];

  const segments = route.split("/").filter(Boolean);
  const pagesAbs = path.join(root, pagesDir);
  const candidates =
    segments.length === 0
      ? ["index"]
      : [segments.join("/"), [...segments, "index"].join("/")];
  for (const candidate of candidates) {
    for (const ext of PAGE_EXTENSIONS) {
      const rel = path.posix.join(pagesDir, `${candidate}${ext}`);
      if (fs.existsSync(path.join(root, rel))) return rel;
    }
  }

  // A rest-parameter page (e.g. blog/[...page].astro) also serves its own
  // directory's index route.
  const dir = path.join(pagesAbs, ...segments);
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    const rest = fs
      .readdirSync(dir)
      .filter((name) => /^\[\.\.\.[^\]]+\]\.(astro|mdx|md)$/.test(name));
    if (rest.length === 1) {
      return path.posix.join(pagesDir, ...segments, rest[0]);
    }
  }
  return "unknown";
}

/**
 * Reads the build-time route map. A missing map is not an error: content
 * routes then report "unknown" as their source.
 *
 * @param {string} file Absolute path.
 * @returns {Record<string, string>}
 */
export function readRouteSources(file) {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/**
 * Reads the build-time route map from the checks' output directory.
 *
 * @param {{ outputDir: string, abs: (p: string) => string }} config
 * @returns {Record<string, string>}
 */
export function loadRouteSources(config) {
  return readRouteSources(
    config.abs(path.join(config.outputDir, ROUTE_SOURCES_OUTPUT)),
  );
}
