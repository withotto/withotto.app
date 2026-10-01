/**
 * `pnpm check:links`: lychee over the built pages, with links to the site's
 * own origin checked against `dist/` instead of production.
 *
 * Every page carries absolute links to itself (canonical, og:url). Checked
 * against production, a page that isn't deployed yet fails on its own
 * canonical, and a link to a page this change removes still passes.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./lib/config.mjs";

/**
 * lychee `--remap` arguments sending the site's own URLs to the build.
 * Rules apply in order, so `/404/`, which Netlify serves from `404.html`,
 * comes before the general rule.
 *
 * @param {string} site The production origin, e.g. "https://withotto.app".
 * @param {string} distDir Absolute path to the build.
 * @returns {string[]}
 */
export function remapArgs(site, distDir) {
  const origin = site
    .replace(/\/+$/, "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Encoded, so a path with spaces stays one URL in lychee's
  // whitespace-separated rule.
  const dist = pathToFileURL(distDir + path.sep).href;
  return [
    "--remap",
    `^${origin}/404/$ ${dist}404.html`,
    "--remap",
    `^${origin}/(.*)$ ${dist}$1`,
  ];
}

/**
 * The whole lychee command line for the built site.
 *
 * @param {{ site: string, distDir: string }} config
 * @param {string} distDir Absolute path to the build.
 * @returns {string[]}
 */
export function lycheeArgs(config, distDir) {
  return [
    `./${config.distDir}/**/*.html`,
    "--include-fragments",
    // A remapped page URL is a directory. Without this, any existing
    // directory passes, even one whose own page was removed, and a fragment
    // is looked for in the directory rather than its page.
    "--index-files",
    "index.html",
    ...remapArgs(config.site, distDir),
  ];
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const config = await loadConfig();
  const result = spawnSync(
    "lychee",
    lycheeArgs(config, path.resolve(config.distDir)),
    { stdio: "inherit" },
  );
  process.exit(result.status ?? 1);
}
