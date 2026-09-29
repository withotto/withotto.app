import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * @typedef {object} ComponentRoot
 * @property {string} name      Stable name used in findings and baseline keys.
 * @property {string} selector  CSS selector for the component's root element.
 * @property {string} source    Source file reported for findings under it.
 *
 * @typedef {object} ChecksConfig
 * @property {string} site
 * @property {string} distDir
 * @property {string} pagesDir
 * @property {string} redirectsFile
 * @property {string} sitemapIndex
 * @property {"always"} trailingSlash
 * @property {string} outputDir
 * @property {string} baselineFile
 * @property {ComponentRoot[]} componentRoots
 * @property {string[]} blockedHosts
 * @property {number} previewPort
 * @property {{ routes: string[] }} exclusions
 */

/**
 * Loads `checks.config.mjs` from the repo root and resolves its paths.
 *
 * @param {string} [root] Repo root. Defaults to the current directory, which
 *   is where pnpm runs scripts from.
 * @returns {Promise<ChecksConfig & { root: string, abs: (p: string) => string }>}
 */
export async function loadConfig(root = process.cwd()) {
  const file = path.join(root, "checks.config.mjs");
  const { default: config } = await import(pathToFileURL(file).href);
  return { ...config, root, abs: (p) => path.resolve(root, p) };
}
