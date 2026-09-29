import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Emitted by `src/pages/checks-route-sources.json.ts`. */
export const ROUTE_SOURCES_FILE = "checks-route-sources.json";

/**
 * Moves the build-time route map out of `dist/` into the checks' output
 * directory, so it is never deployed. The checks read it to report a blog
 * post's own `.mdx` file as the source of its findings.
 *
 * @param {{ outputDir: string }} options outputDir relative to the project root.
 * @returns {import("astro").AstroIntegration}
 */
export default function routeSources({ outputDir }) {
  let root = process.cwd();
  return {
    name: "checks-route-sources",
    hooks: {
      "astro:config:done": ({ config }) => {
        root = fileURLToPath(config.root);
      },
      "astro:build:done": ({ dir }) => {
        const from = path.join(fileURLToPath(dir), ROUTE_SOURCES_FILE);
        if (!fs.existsSync(from)) return;
        const to = path.join(root, outputDir, "route-sources.json");
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(from, to);
        fs.rmSync(from);
      },
    },
  };
}
