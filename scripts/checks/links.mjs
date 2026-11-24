/**
 * `pnpm check:links`: lychee over the built pages, with links to the site's
 * own origin checked against `dist/` instead of production, and links to
 * files in the site's own GitHub repo checked against the working tree.
 *
 * Every page carries absolute links to itself (canonical, og:url). Checked
 * against production, a page that isn't deployed yet fails on its own
 * canonical, and a link to a page this change removes still passes.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./lib/config.mjs";
import { runMain } from "./lib/run.mjs";

/**
 * lychee `--remap` arguments sending the site's own URLs to the build, and,
 * when `repo` is given, the repo's GitHub `blob/main/` URLs to the working
 * tree, so a link to a file this change adds passes before it is on `main`.
 * Only a path of plain characters is sent there: lychee resolves `..` and
 * `%2E%2E` segments before remapping, but a segment such as `..%2F` would
 * decode on disk into a path outside the repo, so anything percent-encoded is
 * left for lychee to check on GitHub.
 * Rules apply in order, so `/404/`, which Netlify serves from `404.html`,
 * comes before the general rule.
 *
 * @param {string} site The production origin, e.g. "https://withotto.app".
 * @param {string} distDir Absolute path to the build.
 * @param {{ url: string, root: string } | null} [repo] The repo's GitHub URL,
 *   e.g. "https://github.com/withotto/withotto.app", and its absolute root.
 * @returns {string[]}
 */
export function remapArgs(site, distDir, repo = null) {
  const escape = (/** @type {string} */ text) =>
    text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const origin = escape(site.replace(/\/+$/, ""));
  // Encoded, so a path with spaces stays one URL in lychee's
  // whitespace-separated rule.
  const dist = pathToFileURL(distDir + path.sep).href;
  const args = [
    "--remap",
    `^${origin}/404/$ ${dist}404.html`,
    "--remap",
    `^${origin}/(.*)$ ${dist}$1`,
  ];
  if (repo) {
    const root = pathToFileURL(repo.root + path.sep).href;
    args.push(
      "--remap",
      `^${escape(repo.url)}/blob/main/([A-Za-z0-9._/-]+)$ ${root}$1`,
    );
  }
  return args;
}

/**
 * The whole lychee command line for the built site.
 *
 * @param {{ site: string, distDir: string, repoUrl?: string, root?: string }} config
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
    ...remapArgs(
      config.site,
      distDir,
      config.repoUrl ? { url: config.repoUrl, root: config.root ?? "." } : null,
    ),
  ];
}

runMain(import.meta.url, "links", async () => {
  const config = await loadConfig();
  const result = spawnSync(
    "lychee",
    lycheeArgs(config, path.resolve(config.distDir)),
    { stdio: "inherit" },
  );
  if (result.error) {
    console.error(
      `check:links could not run lychee (${result.error.message}). Install it with mise, which pins it in mise.toml.`,
    );
  }
  return result.status ?? 1;
});
