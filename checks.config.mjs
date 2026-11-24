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
  redirectsFile: "public/_redirects",
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
  // live sales inbox for every visitor, including a headless browser. The
  // bookings embed is a live service: a slow response would stall the page's
  // load event and fail the run, and its injected markup is not ours to check.
  blockedHosts: ["chat.withotto.app", "bookings.withotto.app"],

  // Fixed so a check never picks up a preview server Stuart already has open
  // (astro preview defaults to 4321) or collides with `dev:all`.
  previewPort: 4391,

  // A claim on a published page (a `data-claim-checked` date) warns once its
  // checked date is more than warnDays old and blocks past blockDays, so a
  // competitor fact is re-checked against its source before it goes stale.
  claimAge: { warnDays: 45, blockDays: 90 },

  // This site's repo. The link check reads its blob/main/ URLs (the competitor
  // data files the comparison pages link to) from the working tree, so a PR
  // adding a file passes before the file is on main.
  repoUrl: "https://github.com/withotto/withotto.app",

  exclusions: {
    // Routes no check reports on. Empty today.
    routes: [],
  },
};
