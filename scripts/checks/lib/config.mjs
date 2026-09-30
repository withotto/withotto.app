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
  let config;
  try {
    ({ default: config } = await import(pathToFileURL(file).href));
  } catch (error) {
    if (/** @type {any} */ (error)?.code === "ERR_MODULE_NOT_FOUND") {
      throw new Error(
        `No checks.config.mjs in ${root}. Run the checks from the repo root.`,
      );
    }
    throw error;
  }
  const problems = validateConfig(config);
  if (problems.length > 0) {
    throw new Error(`checks.config.mjs is invalid: ${problems.join("; ")}`);
  }
  return { ...config, root, abs: (p) => path.resolve(root, p) };
}

const STRING_KEYS = [
  "site",
  "distDir",
  "pagesDir",
  "redirectsFile",
  "sitemapIndex",
  "outputDir",
  "baselineFile",
];

/**
 * Checks the shape the checks rely on, so a missing or misspelled key fails
 * here rather than deep inside a check. A dropped `blockedHosts` would
 * otherwise let the a11y run reach live third-party hosts.
 *
 * @param {unknown} config
 * @returns {string[]} Problems, empty when valid.
 */
export function validateConfig(config) {
  if (typeof config !== "object" || config === null) {
    return ["it must `export default` an object"];
  }
  const c = /** @type {Record<string, any>} */ (config);
  const problems = [];
  for (const key of STRING_KEYS) {
    if (typeof c[key] !== "string" || c[key] === "") {
      problems.push(`${key} must be a non-empty string`);
    }
  }
  if (c.trailingSlash !== "always")
    problems.push('trailingSlash must be "always"');
  if (
    !Number.isInteger(c.previewPort) ||
    c.previewPort < 1 ||
    c.previewPort > 65535
  ) {
    problems.push("previewPort must be a port number");
  }
  if (
    !Array.isArray(c.blockedHosts) ||
    !c.blockedHosts.every((h) => typeof h === "string" && h !== "")
  ) {
    problems.push("blockedHosts must be an array of host names");
  }
  if (
    !Array.isArray(c.componentRoots) ||
    !c.componentRoots.every(
      (r) =>
        r &&
        ["name", "selector", "source"].every(
          (k) => typeof r[k] === "string" && r[k] !== "",
        ),
    )
  ) {
    problems.push(
      "componentRoots must be an array of { name, selector, source } strings",
    );
  }
  if (
    !Array.isArray(c.exclusions?.routes) ||
    !c.exclusions.routes.every((r) => typeof r === "string")
  ) {
    problems.push("exclusions.routes must be an array of routes");
  }
  return problems;
}
