/**
 * Site-specific settings for the accessibility and SEO checks in
 * `scripts/checks/`. The check code stays site-agnostic; anything that differs
 * between withotto.app and support.withotto.app belongs here.
 */

/** @type {import("./scripts/checks/lib/config.mjs").ChecksConfig} */
export default {
  site: "https://withotto.app",
  distDir: "dist",
  pagesDir: "src/pages",
  redirectsFile: "_redirects",
  sitemapIndex: "sitemap-index.xml",
  trailingSlash: "always",

  // Gitignored. The report and the build-time route map live here.
  outputDir: ".checks",
  baselineFile: "checks-baseline.json",

  // Findings merge across pages only when their element sits under one of
  // these roots. Order matters: the first root that contains the element wins.
  componentRoots: [
    {
      name: "navbar",
      selector: "header",
      source: "src/components/navbar/navbar.astro",
    },
    {
      name: "footer",
      selector: "body > footer",
      source: "src/components/footer.astro",
    },
    {
      name: "table-of-contents",
      selector: "nav.toc-list",
      source: "src/components/TableOfContents.astro",
    },
  ],

  // Third-party hosts no check may contact. Chatwoot creates a contact in the
  // live sales inbox for every visitor, including a headless browser.
  blockedHosts: ["chat.withotto.app"],

  // Fixed so a check never picks up a preview server Stuart already has open
  // (astro preview defaults to 4321) or collides with `dev:all`.
  previewPort: 4391,

  exclusions: {
    // Routes no check reports on. Empty today.
    routes: [],
  },
};
