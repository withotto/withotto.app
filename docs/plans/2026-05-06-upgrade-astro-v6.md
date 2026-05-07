# Astro v6 Upgrade Implementation Plan

Created: 2026-05-06
Author: stuart@withotto.app
Status: VERIFIED
Approved: Yes
Iterations: 0
Worktree: No
Type: Feature

## Summary

**Goal:** Upgrade the withotto.app marketing site from Astro v5.17 to the latest Astro v6, applying every required code/config change documented in the official v6 upgrade guide. Use `@astrojs/upgrade` for the dependency bump, and complete two prerequisite migrations (content collections → Content Layer API, Tailwind v3 → v4) before invoking it so the version bump lands on already-compliant code.

**Architecture:** Three sequential, independently verifiable migrations on the current `feat/upgrade-astro-v6` branch — each works on Astro 5 and produces a green build, so the v6 cutover itself becomes a small mechanical step rather than a big-bang change. The site's runtime shape (static Astro → Netlify) is unchanged.

**Tech Stack:** Astro 6, Tailwind 4 via `@tailwindcss/vite`, `@tailwindcss/typography` v0.5.19+, `@astrojs/mdx`, `@astrojs/sitemap`, `astro-icon`, MDX content collections via the Content Layer `glob()` loader, Zod 4 from `astro/zod`. Static deploy on Netlify, Node 24.15.0 pinned via `.nvmrc` (already exceeds v6's 22.12 floor).

## Scope

### In Scope

- Bump `astro` from `^5.17.2` to the latest v6.x via `pnpm dlx @astrojs/upgrade`.
- Bump official integrations the upgrade tool manages (`@astrojs/mdx`, `@astrojs/sitemap`) to their v6-compatible majors.
- Migrate content collections from the legacy v2 API (`src/content/config.ts`, no loader, `entry.render()`, `entry.slug`) to the Content Layer API (`src/content.config.ts`, `glob()` loader, `render(entry)`, `entry.id` + `entry.filePath`). Preserve current blog URL `/blog/bank-rule-activity-report/`.
- Migrate Tailwind from v3 + `@astrojs/tailwind` to v4 + `@tailwindcss/vite`. Translate `tailwind.config.cjs` (brand tokens, font, typography plugin) to a CSS-first `@theme` block in `src/styles/global.css`.
- Update Zod imports (`astro:content` → `astro/zod`) and Zod 4 syntax (`z.string().url()` → `z.url()`).
- Verify the build, format check, and broken-link check still pass; visually smoke-test every distinct page template in a browser.

### Out of Scope

- Tailwind utility audits or visual redesigns beyond preserving current appearance. Brand tokens are translated 1:1.
- Changes to Supabase edge functions in `supabase/functions/` — they run on Deno and are unaffected by the Astro upgrade. (`tsconfig.json` already excludes them.)
- Changes to Netlify deploy config (`_redirects`, `netlify.toml` absent) — the `.nvmrc` already pins a v6-compatible Node version.
- Adding a Cloudflare/Node/Vercel adapter — the site is fully static.
- Astro Actions, sessions, ViewTransitions, ASSETS_PREFIX, Astro.glob — none are used in this codebase (verified by exhaustive grep below).
- Astro 6's new optional features (CSP, fonts experimental → stable, live content collections) — adopting them is not required for the upgrade.

## Approach

**Chosen:** Three sequential prerequisite migrations on Astro 5, then run `@astrojs/upgrade`, then a small post-upgrade cleanup pass.

**Why:** The two breaking-change touchpoints in this codebase (legacy content collections, deprecated `@astrojs/tailwind`) both have well-supported migration paths that work on Astro 5 today. Doing them on Astro 5 keeps each step independently buildable and reviewable, and reduces the v6 cutover itself to a mechanical version bump that the official tool handles. It also matches the user instruction to prefer automated upgrade processes for the parts where automation exists.

**Alternatives considered:**

- *Run `@astrojs/upgrade` first, then fix the breakage.* Rejected — the upgrade tool only bumps versions; it does not migrate content collections or replace the deprecated Tailwind integration. Running it first leaves the project in a broken intermediate state where `pnpm build` fails and bisection is harder.
- *Defer Tailwind v4 to a follow-up PR.* Rejected per user choice (Tailwind v4 selected in clarification). Keeping the same number of moving parts but in a smaller blast radius would have been the alternative.

## Context for Implementer

> Written for an implementer who has never seen this codebase.

- **Patterns to follow:**
  - Layouts nest `Layout.astro` → `RootLayout.astro` (`src/layouts/Layout.astro:1`). New global imports (CSS) go at the top of `RootLayout.astro` next to the existing `import "@fontsource-variable/rethink-sans"` (`src/layouts/RootLayout.astro:4`).
  - Path aliases (`@components/*`, `@layouts/*`, `@utils/*`) are mandatory; no relative `../../` imports. See `tsconfig.json:8`.
  - 2-space indent, Prettier with `prettier-plugin-astro` and `prettier-plugin-tailwindcss`. Run `pnpm format` before commit; CI gate is `pnpm format:check`.
  - `trailingSlash: "always"` (`astro.config.mjs:11`) — preserve trailing slashes on every internal link.

- **Conventions:**
  - `pnpm` exclusively (pinned to `pnpm@10.33.4` in `package.json:48`); never introduce npm/yarn lockfiles.
  - Content collection schema lives in **one** file; the legacy location was `src/content/config.ts` but v6 requires `src/content.config.ts` (without the slash). Move the file, do not duplicate.
  - Prefer `import { z } from "astro/zod"` (the v6 canonical export) over the deprecated `astro:content` re-export and the deprecated `astro:schema` alias.
  - Image paths in MDX frontmatter use a project-root path like `/src/assets/blog/product-updates.jpg` and are resolved by Astro's `image()` schema helper at build time.

- **Key files:**
  - `astro.config.mjs` — Astro config. Will lose `tailwind()` integration import and gain `vite.plugins: [tailwindcss()]`.
  - `tailwind.config.cjs` — to be deleted; theme tokens move into `src/styles/global.css` `@theme` block.
  - `src/styles/global.css` — currently empty (0 bytes). Becomes the Tailwind v4 entry: `@import "tailwindcss"`, `@plugin "@tailwindcss/typography"`, `@theme { … }`.
  - `src/content/config.ts` — legacy collections config; renamed to `src/content.config.ts` and rewritten with the `glob()` loader.
  - `src/utils/blog.ts` — helper that derives URL slugs and folder labels from collection entries; `entry.slug` and the `entry.id`-as-path assumptions both change.
  - `src/pages/blog/[slug].astro` — uses `entry.render()` (legacy) and `getBlogSlug(entry)`.
  - `src/pages/blog/[...page].astro` — uses `getCollection("blog", filterFn)`; only impacted by the schema change.
  - `src/components/BookingForm.astro`, `src/components/TableOfContents.astro`, `src/layouts/LandingLayout.astro` — contain `@apply` inside `<style>` blocks; in Tailwind v4 these blocks need a `@reference "../styles/global.css"` directive at the top to see project tokens.
  - `src/layouts/RootLayout.astro` — site-wide `<head>`. The new global CSS import goes here.
  - `_redirects` — Netlify rewrites; nothing to update for this work.

- **Gotchas:**
  - The single existing blog post at `src/content/blog/product-updates/2025-06-05-bank-rule-activity-report.mdx` is the only collection entry. Easy to validate end-to-end, but easy to lose visibility on if a wider collection breaks silently.
  - With the `glob()` loader, the Content Layer assigns `entry.id` from the **path relative to `base`, minus the file extension**. With `base: './src/content/blog'` and pattern `**/[^_]*.{md,mdx}`, the existing post produces `entry.id === "product-updates/2025-06-05-bank-rule-activity-report"` — the subfolder is part of the id, not stripped. The original filename and full path remain on `entry.filePath`.
  - Consequence for the helper: `getBlogSlug()` cannot apply the date-strip regex directly to `entry.id` because it starts with `product-updates/`. The basename must be extracted first, then the date prefix stripped: `entry.id.split('/').pop().replace(/^\d{4}-\d{2}-\d{2}-/, '')`.
  - `getBlogFolder()` reads `entry.id.split('/')[0]` — the first segment is the subfolder under `base`. (`entry.filePath` would also work, but using `entry.id` keeps both helpers consistent and avoids assuming a file-based loader.)
  - `astro:content` no longer re-exports `z` in v6, but `defineCollection` and `getCollection` are still imported from there. Don't accidentally remove the whole `astro:content` import.
  - In Tailwind v4, `@apply` inside scoped Astro `<style>` blocks does *not* automatically see your `@theme` tokens. The fix is `@reference "../styles/global.css"` (relative to the component) at the top of the block. Without it, `@apply text-primary` and similar will fail to compile.
  - Tailwind v4 `@theme` color names use `--color-<name>-<shade>` format. The current config has nested objects like `primary.DEFAULT`/`.soft`/`.strong`/`.accent`/`.medium`. Translation: `--color-primary: #02AC8A` (DEFAULT), `--color-primary-soft: #E9F2E1`, etc.
  - `prettier-plugin-tailwindcss@^0.7.2` already supports both Tailwind v3 and v4. No version change required, but a `tailwindStylesheet` config entry (pointing at `src/styles/global.css`) lets the plugin sort utilities correctly under v4.
  - Build link checker (`lychee`) reads from `dist/**/*.html`; `pnpm check-links` already includes the build step. It will catch any URL regressions including the blog detail page.

- **Domain context:**
  - Static marketing site. No SSR, no adapter, no on-demand pages, no Astro Actions, no sessions, no ViewTransitions.
  - One content collection (`blog`) with one entry. Blog routing uses two pages: `[slug].astro` for detail, `[...page].astro` for paginated index.
  - Five MDX legal pages in `src/pages/` use `MdLayout.astro` and a `TableOfContents` component generated from `headings`. The Markdown heading-ID change in v6 (trailing hyphens preserved on headings ending in special characters) only affects one heading ("Additional disclosures … (UK)") and there are no internal anchor links anywhere in `src/`, so the visible impact is zero.

## Runtime Environment

- **Start command:** `pnpm dev` (runs `astro dev` on port 4321).
- **Port:** 4321 (default Astro dev server).
- **Deploy path:** Netlify static site at https://withotto.app, built with `astro build` → `dist/`.
- **Health check:** `pnpm build` exit 0 + `pnpm check-links` exit 0.
- **Restart procedure:** Ctrl-C the dev server; `rm -rf node_modules .astro dist && pnpm install && pnpm dev` if you suspect cache corruption between major-version steps.

## Assumptions

- `@astrojs/upgrade` will pick the latest stable Astro 6.x and matching `@astrojs/mdx` / `@astrojs/sitemap` majors. (Supported by the v6 upgrade guide's documented use of the tool.) — Tasks 4 and 5 depend on this.
- Tailwind v4 (`tailwindcss@^4`) plus `@tailwindcss/typography@^0.5.19` (already the project's pinned floor) will produce visually identical output for our utility usage when the `@theme` translation maps the existing palette 1:1. (Confirmed in Tailwind v4 release notes; typography plugin already at v0.5.19 with Tailwind v4 support.) — Task 3 depends on this.
- Netlify reads `.nvmrc` automatically and uses the pinned Node `24.15.0`. (Netlify documented behaviour; no `netlify.toml` overrides Node.) — Task 6 verification depends on this.
- The `glob()` loader's default ID generation produces a path-relative slug (subfolder included), minus the file extension — for the existing post that is `product-updates/2025-06-05-bank-rule-activity-report`. The subfolder is preserved in `entry.id`, NOT stripped. Verified against the Content Layer documentation; the `getBlogSlug()` implementation in Task 2 accounts for this by extracting the basename before stripping the date prefix. — Task 2 depends on this.
- No analytics, ads, embeds, or external CSS files reference Tailwind class names that we'd need to keep stable beyond what's already in the source tree. (Verified: BookingForm, NewsletterSignup, StatsContainer all build their own UI with classes used inside the same component.) — Task 3 depends on this.
- The single blog post `bank-rule-activity-report.mdx` is the only existing public URL that would change if the migration were done wrong; preserving its URL is sufficient SEO protection. — Task 2 depends on this.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Tailwind v4 produces visual regressions across the site (utility-name drift, plugin compatibility, `@apply` in scoped styles) | Medium | High (site-wide visual breakage) | Translate `tailwind.config.cjs` colours/fonts 1:1 into `@theme`; add `@reference "../styles/global.css"` to every `<style>` block that uses `@apply`; smoke-test each page template (home, blog index, blog detail, bank-reconciliation, capture, privacy-policy, brand-kit) in Claude Code Chrome with snapshot + click before/after |
| Content collection migration silently breaks `/blog/bank-rule-activity-report/` URL or article rendering | Low | High (404 on the only blog post + SEO regression) | Verify URL stays `/blog/bank-rule-activity-report/` post-migration; render the post; confirm image, audio (if present), and tags render; lychee link check passes |
| `@astrojs/upgrade` pulls a non-semver bump that breaks an undocumented assumption | Low | Medium | Run upgrade in a clean `pnpm-lock.yaml` state; review the diff before commit; if it pulls something unexpected, pin manually instead |
| `prettier-plugin-astro@^0.14.1` or `prettier-plugin-tailwindcss@^0.7.2` produces churn under Astro v6 / Tailwind v4 | Low | Low (CI noise) | Run `pnpm format` once after each task; commit any whitespace-only churn separately; bump plugin versions only if a real incompatibility surfaces |
| `import.meta.env.PUBLIC_STATS_API_URL` (used in `StatsContainer.astro`) changes value type or inlining behaviour | Very low | Low | v6 inlines `PUBLIC_*` strings unchanged (this is the new default and matches current behaviour); manual smoke test of `/bank-reconciliation/` confirms stats panel renders |
| `getStaticPaths` in blog routes regresses (number→string param check) | Very low | Low | `params.slug` is already a string from `getBlogSlug()`; verified by reading `[slug].astro:14`. No change required, but typecheck after migration. |
| Image rendering changes (default cropping, no-upscale, SVG rasterization) produce visible differences | Low | Low | All `<Image>`/`<Picture>` usage already passes `width` and `height` and `format` only on rasters; the `clients-alt.astro` SVGs do not pass `format`, so rasterization is not triggered. Visually verify hero image and blog post hero image. |

⚠️ Mitigations are commitments — verification (Task 6) checks each one is implemented.

## Goal Verification

### Truths

1. `pnpm build` exits 0 against Astro v6.x with no error or deprecation warning printed for any feature this project actually uses (TS-001).
2. `pnpm check-links` exits 0; the only existing blog URL `/blog/bank-rule-activity-report/` is reachable; all internal links continue to resolve to 200s in the built `dist/` output (TS-002, TS-005).
3. `pnpm format:check` exits 0 (TS-001).
4. The home page, the blog index, the blog detail post, both product pages (Bank Rec, Capture), and the brand-kit page render in a browser with no visible regression versus the pre-upgrade snapshot — fonts, brand colours, typography, spacing, and images preserved (TS-003).
5. The `<TableOfContents>` on `/privacy-policy/` renders with working anchor links to every `h2`/`h3`; the rest of the legal pages render without console errors (TS-004).
6. `astro.config.mjs` no longer imports `@astrojs/tailwind`; `tailwind.config.cjs` is removed; `src/content/config.ts` is removed; the only Tailwind plugin reference in the project is `@tailwindcss/vite` plus the `@plugin "@tailwindcss/typography"` directive in `src/styles/global.css` (TS-001).
7. `pnpm list astro` reports a v6.x version; `pnpm list @astrojs/mdx @astrojs/sitemap` report their v6-compatible majors (TS-001).

### Artifacts

- `package.json` (updated dependency block, `tailwindcss@^4`, `@tailwindcss/vite@^4`, `@tailwindcss/typography@^0.5.19` unchanged, no `@astrojs/tailwind`, `astro@^6.2.2`, `@astrojs/mdx@^5.0.4`, `@astrojs/sitemap@^3.7.2`)
- `pnpm-lock.yaml` (updated)
- `astro.config.mjs` (Vite plugin path, no Tailwind integration import)
- `src/styles/global.css` (Tailwind v4 entry with `@theme` brand tokens)
- `src/content.config.ts` (Content Layer config with `glob()` loader, `astro/zod`)
- `src/utils/blog.ts` (uses `entry.id` and `entry.filePath`)
- `src/pages/blog/[slug].astro` (uses `render(entry)` from `astro:content`)
- Browser snapshots taken during Task 6 (paste into PR description, not committed)

## E2E Test Scenarios

### TS-001: Build, format, and dependency state are clean

**Priority:** Critical
**Preconditions:** Branch `feat/upgrade-astro-v6` checked out, `pnpm install` completed.
**Mapped Tasks:** Task 1, Task 2, Task 3, Task 4, Task 5, Task 6.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pnpm install` | Exit 0, no peer-dependency errors |
| 2 | `pnpm format:check` | Exit 0 |
| 3 | `pnpm build` | Exit 0; build summary mentions Astro 6.x; no deprecation warnings for content collections, Tailwind, or Zod APIs we use |
| 4 | `pnpm list astro @astrojs/mdx @astrojs/sitemap @tailwindcss/vite tailwindcss @tailwindcss/typography` | Astro is 6.x; mdx/sitemap on their v6-compatible majors; `@astrojs/tailwind` not present; `tailwindcss` is 4.x; typography is 0.5.16+ |
| 5 | `git ls-files \| grep -E '(tailwind\\.config\|src/content/config\\.ts)'` | Empty output |

### TS-002: Blog detail URL is preserved

**Priority:** Critical
**Preconditions:** Build complete in `dist/`.
**Mapped Tasks:** Task 2.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `ls dist/blog/bank-rule-activity-report/index.html` | File exists |
| 2 | `pnpm dev` and navigate to `http://localhost:4321/blog/bank-rule-activity-report/` (Claude Code Chrome) | Page renders; title "See Otto's Daily Work: New Bank Rule Activity Report" visible; hero image visible; published date "5 June 2025" visible |
| 3 | Click the back-to-blog button | Lands on `/blog/` listing showing the same post card |
| 4 | From `/blog/`, click the post card | Returns to `/blog/bank-rule-activity-report/` (URL unchanged) |

### TS-003: Site-wide visual smoke test (Tailwind v4 parity)

**Priority:** Critical
**Preconditions:** Dev server running at `localhost:4321`. Pre-upgrade snapshots captured at the start of Task 3 for direct comparison.
**Mapped Tasks:** Task 3.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Snapshot `/` (home) | Hero, brand colours (primary teal, terracotta accent), Rethink Sans font, navbar, footer all present and visually identical to pre-upgrade snapshot |
| 2 | Snapshot `/bank-reconciliation/` | Stats panel loads (StatsContainer custom element fires `fetch`); product copy formatted with `prose` typography styling |
| 3 | Snapshot `/capture/` | Beta badge, hero, feature lists render in expected colours |
| 4 | Snapshot `/brand-kit/` | All brand swatches (primary/terracotta/mindaro/muted/success/warning/danger/info) render with correct hex values matching `tailwind.config.cjs` originals |
| 5 | Resize viewport to 375×800 (mobile) on home and Capture pages | Mobile navbar opens/closes via the burger button; layout responsive; no horizontal scroll |
| 6 | Open BookingForm component on whichever page hosts it | Form renders, `data-query` attribute on the embed includes the `affiliateId` from query string when one is set (or empty when not) |

### TS-004: Legal-page TOC and anchors

**Priority:** High
**Preconditions:** Dev server running.
**Mapped Tasks:** Task 4 (Astro v6 upgrade), Task 6 (verification).

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `/privacy-policy/` | Page renders; `<TableOfContents>` shows H2/H3 entries |
| 2 | Click any TOC link | Browser scrolls to the corresponding heading (anchor IDs match between TOC and headings) |
| 3 | Click the "(UK)" heading TOC entry, if present | Scrolls to that heading; anchor ID may now end with a trailing hyphen but the click works because the TOC and the heading were generated by the same plugin in the same build |
| 4 | Navigate `/cookie-policy/`, `/terms-and-conditions/`, `/acceptable-use-policy/`, `/bank-rec-security-and-privacy/` | Each page renders; `lastUpdated` date and PDF download link visible where defined; no console errors |

### TS-005: Pre-existing redirects and link integrity

**Priority:** High
**Preconditions:** Build complete; dev server running.
**Mapped Tasks:** Task 6.

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | `pnpm check-links` | Exit 0 (lychee finds no broken internal links in `dist/**/*.html`) |
| 2 | Navigate to `/business/` (dev server may not honour `_redirects`; production check is the real test, but verify the app doesn't have a colliding page) | No `src/pages/business.*` page exists in source; no compiled `dist/business/` folder |
| 3 | Navigate to `/blog/` | Index renders one post card |

## Progress Tracking

- [x] Task 1: Pre-flight baseline check
- [x] Task 2: Migrate content collections to Content Layer API (Astro 5)
- [x] Task 3: Migrate Tailwind v3 → v4 via @tailwindcss/vite (Astro 5)
- [x] Task 4: Run `@astrojs/upgrade` and resolve dependency bump
- [x] Task 5: Post-upgrade Zod and deprecation cleanup
- [x] Task 6: Verify build, format, link check, and visually smoke-test all page templates

**Total Tasks:** 6 | **Completed:** 6 | **Remaining:** 0

## Implementation Tasks

### Task 1: Pre-flight baseline check

**Objective:** Confirm the project builds cleanly on Astro 5 before any change, so any later regression is unambiguously caused by the migration. Capture a pre-upgrade browser snapshot of the home page, the blog detail page, and `/brand-kit/` for direct visual comparison in Task 3 and Task 6.

**Dependencies:** None.
**Mapped Scenarios:** Supports TS-001, TS-003.

**Files:**

- Modify: none (read-only baseline).

**Trivial:** Omit. (Diagnostic step; no production code, but it is the gate that defines what "regression" means later.)

**Key Decisions / Notes:**

- This task does not modify the codebase. If `pnpm build` fails on `main` for an unrelated reason, stop and surface the issue to the user before continuing — fixing pre-existing failures is not in scope.
- Snapshot artefacts are not committed; they live only in the agent's session and are cited in the PR description.

**Definition of Done:**

- [ ] `pnpm install` exits 0 with no peer-dep errors.
- [ ] `pnpm format:check` exits 0.
- [ ] `pnpm build` exits 0 on Astro 5.17.x.
- [ ] Pre-upgrade browser snapshots captured for `/`, `/blog/bank-rule-activity-report/`, `/brand-kit/`, `/privacy-policy/` (used as the visual baseline for Task 3 and Task 6).

**Verify:**

- `pnpm install && pnpm format:check && pnpm build`
- Claude Code Chrome: snapshot the four pages above on the running dev server.

### Task 2: Migrate content collections to Content Layer API (still on Astro 5)

**Objective:** Move the legacy v2 content-collections setup to the Content Layer API so the v6 cutover is a non-event for the blog. Preserve the existing `/blog/bank-rule-activity-report/` URL exactly. This task runs entirely on Astro 5 and produces a green build before any version bump.

**Dependencies:** Task 1.
**Mapped Scenarios:** TS-002, TS-001.

**Files:**

- Create: `src/content.config.ts` (new location for the collections config, replacing `src/content/config.ts`)
- Delete: `src/content/config.ts` (legacy location; v6 throws `LegacyContentConfigError` if it stays)
- Modify: `src/utils/blog.ts` (read `entry.id` and `entry.filePath` instead of `entry.slug` and path-encoded `entry.id`)
- Modify: `src/pages/blog/[slug].astro` (use `render(entry)` from `astro:content`; pass `getBlogSlug(entry)` unchanged)
- Modify: `src/pages/blog/[...page].astro` (no API change required; verify still typechecks)

**Trivial:** Omit.

**Key Decisions / Notes:**

- New `src/content.config.ts` shape:
  ```ts
  import { defineCollection } from "astro:content";
  import { glob } from "astro/loaders";
  import { z } from "astro/zod";

  const blog = defineCollection({
    loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: "./src/content/blog" }),
    schema: ({ image }) =>
      z.object({
        draft: z.boolean(),
        title: z.string(),
        excerpt: z.string(),
        slug: z.string().optional(),
        image: image(),
        imageAlt: z.string(),
        imageDescription: z.string(),
        imageCredit: z.string().optional(),
        imageCreditUrl: z.url().optional(),
        publishDate: z.string().transform((str: string) => new Date(str)),
        category: z.string(),
        tags: z.array(z.string()),
        audioFile: z.string().optional(),
      }),
  });

  export const collections = { blog };
  ```
  - `astro:content` keeps `defineCollection`; `z` moves to `astro/zod`; `loader: glob(...)` is added; the deprecated `z.string().url()` becomes `z.url()` (Zod 4 syntax) so the post-upgrade Zod 4 bump is also handled here. (Zod 3.x in Astro 5 already supports `z.url()` as an alias.)
- New `src/utils/blog.ts` shape (typed):
  ```ts
  import type { CollectionEntry } from "astro:content";

  type BlogEntry = CollectionEntry<"blog">;

  export function getBlogSlug(entry: BlogEntry): string {
    if (entry.data.slug) return entry.data.slug;
    // entry.id is path-relative under Content Layer, e.g.
    // "product-updates/2025-06-05-bank-rule-activity-report".
    // Take the basename, then strip the YYYY-MM-DD- date prefix.
    const basename = entry.id.split("/").pop() ?? entry.id;
    return basename.replace(/^\d{4}-\d{2}-\d{2}-/, "");
  }

  export function getBlogFolder(entry: BlogEntry): string {
    // First segment of entry.id is the subfolder under the glob base
    // (e.g. "product-updates"). Falls back to "root" for files at base.
    const segments = entry.id.split("/");
    return segments.length > 1 ? segments[0] : "root";
  }

  export function getContentType(entry: BlogEntry): string {
    const folder = getBlogFolder(entry);
    switch (folder) {
      case "product-updates": return "announcement";
      case "guides": return "tutorial";
      case "case-studies": return "case-study";
      default: return "article";
    }
  }
  ```
  - The old `entry.data.contentType` branch is removed because the schema never declared `contentType`. Replacing `any` with `CollectionEntry<"blog">` satisfies the global TS rule against `any`.
  - The basename extraction in `getBlogSlug()` is the load-bearing change versus the v3 helper: `entry.id` under Content Layer includes the subfolder (`product-updates/...`), unlike the v3 `entry.slug` which was already path-prefixed but consumed by a `.split('/').pop()` step. The two helpers now both pivot on `entry.id`'s structure, so any future folder addition (e.g. `industry-insights/`) needs no further change.
- New `src/pages/blog/[slug].astro` rendering shape:
  ```astro
  ---
  import { getCollection, render } from "astro:content";
  // …
  const { entry } = Astro.props;
  const { Content } = await render(entry);
  ---
  ```
  - Replace exactly two lines: the import (add `, render`) and the call (`await entry.render()` → `await render(entry)`).
- Verify the URL: `getBlogSlug` for the existing post returns `bank-rule-activity-report` (after stripping `2025-06-05-`). Confirmed by reading the regex against the file ID `2025-06-05-bank-rule-activity-report`.
- Note: This task is parsimonious by design — no new test files; the build itself is the integration test for the single existing entry, and the browser snapshot in DoD is the behavioural test (covered by `pnpm build` and TS-002).

**Definition of Done:**

- [ ] `src/content.config.ts` exists; `src/content/config.ts` does not.
- [ ] `pnpm build` exits 0 on Astro 5 with no `LegacyContentConfigError`, no `ContentCollectionMissingALoaderError`, no deprecation warnings about `entry.render` or `astro:content`'s `z`.
- [ ] `entry.id` for the existing post equals `product-updates/2025-06-05-bank-rule-activity-report` (verify by adding a one-line `console.log(blogEntries[0].id)` in `[slug].astro`'s `getStaticPaths` during the task and removing it before commit, OR by inspecting `dist/blog/` paths after build).
- [ ] `dist/blog/bank-rule-activity-report/index.html` exists post-build (this is the URL-preservation contract — the basename-extraction fix in `getBlogSlug()` is what makes this true).
- [ ] No `dist/blog/product-updates/` folder exists post-build (negative check that confirms the subfolder is being stripped, not preserved in the URL).
- [ ] Visiting `http://localhost:4321/blog/bank-rule-activity-report/` renders the post (TS-002 step 2).
- [ ] `dist/blog/index.html` shows the same post card as before (TS-002 step 3).

**Verify:**

- `pnpm build && ls dist/blog/bank-rule-activity-report/index.html dist/blog/index.html && (! ls dist/blog/product-updates 2>/dev/null)`
- `pnpm dev` + Claude Code Chrome navigate to `/blog/`, click the post card, confirm URL `/blog/bank-rule-activity-report/`, confirm post title and hero image.

### Task 3: Migrate Tailwind v3 → v4 via @tailwindcss/vite (still on Astro 5)

**Objective:** Replace the deprecated `@astrojs/tailwind` integration with the official `@tailwindcss/vite` plugin path, upgrade Tailwind to v4, and translate `tailwind.config.cjs` into a CSS-first `@theme` block in `src/styles/global.css`. Preserve every visible style.

**Dependencies:** Task 2 (so the only remaining moving piece is Tailwind).
**Mapped Scenarios:** TS-003, TS-001.

**Files:**

- Modify: `package.json` (remove `@astrojs/tailwind`, change `tailwindcss` from `^3.4.17` to `^4`, add `@tailwindcss/vite@^4`, leave `@tailwindcss/typography@^0.5.19` unchanged — already at the v4-compatible floor)
- Delete: `tailwind.config.cjs`
- Modify: `astro.config.mjs` (remove `tailwind()` integration import and call, add `vite: { plugins: [tailwindcss()] }`)
- Modify: `src/styles/global.css` (was empty; now Tailwind v4 entry + `@theme`)
- Modify: `src/layouts/RootLayout.astro` (add `import "../styles/global.css";` at the top of the frontmatter, next to the existing font import)
- Modify: `src/components/BookingForm.astro` (add `@reference "../styles/global.css";` at the top of its `<style>` block; verify `@apply` still resolves)
- Modify: `src/components/TableOfContents.astro` (same `@reference` directive)
- Modify: `src/layouts/LandingLayout.astro` (same `@reference` directive)
- Modify: `prettier.config.mjs` (add `tailwindStylesheet: "./src/styles/global.css"` so the Tailwind utility-sorter understands v4's CSS-first config)

**Trivial:** Omit.

**Key Decisions / Notes:**

- Use `pnpm dlx astro add tailwind` only to confirm the recommended plugin shape, then commit the diff manually so we keep full control over `astro.config.mjs` (the project's existing config has `image:`, `site:`, `trailingSlash:`, etc., that `astro add` may try to reformat).
- New `astro.config.mjs` shape:
  ```js
  import { defineConfig } from "astro/config";
  import tailwindcss from "@tailwindcss/vite";
  import mdx from "@astrojs/mdx";
  import icon from "astro-icon";
  import slug from "rehype-slug";
  import sitemap from "@astrojs/sitemap";

  export default defineConfig({
    site: "https://withotto.app",
    trailingSlash: "always",
    integrations: [
      mdx({ rehypePlugins: [slug] }),
      sitemap({ filter: (url) => !url.startsWith("https://withotto.app/notebook/") }),
      icon(),
    ],
    image: { responsiveStyles: true, layout: "constrained" },
    vite: { plugins: [tailwindcss()] },
  });
  ```
- New `src/styles/global.css` shape (canonical Tailwind v4):
  ```css
  @import "tailwindcss";
  @plugin "@tailwindcss/typography";

  @theme {
    --font-sans: "Rethink Sans Variable", ui-sans-serif, system-ui, -apple-system,
      BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial,
      "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji",
      "Segoe UI Symbol", "Noto Color Emoji";

    --color-default: #2D2D2D;
    --color-default-soft: #696969;
    --color-default-strong: #000000;

    --color-primary: #02AC8A;
    --color-primary-soft: #E9F2E1;
    --color-primary-accent: #E4EDDB;
    --color-primary-medium: #A1B58F;
    --color-primary-strong: #105E59;

    --color-mindaro: #D6ED89;

    --color-muted: #2c3b2a;
    --color-muted-soft: #F9FAFB;
    --color-muted-strong: #E5E7EB;

    --color-success: #34D399;
    --color-success-soft: #E3FCEF;
    --color-success-strong: #047857;

    --color-warning: #FBBF24;
    --color-warning-soft: #FFFAEB;
    --color-warning-strong: #A16207;

    --color-danger: #EF4444;
    --color-danger-soft: #FEF2F2;
    --color-danger-strong: #7F1D1D;

    --color-info: #3B82F6;
    --color-info-soft: #EFF6FF;
    --color-info-strong: #1E40AF;

    --color-terracotta: #e67d5f;
    --color-terracotta-soft: #faf3f0;
    --color-terracotta-medium: #f0b8a6;
    --color-terracotta-strong: #b85a3d;
  }
  ```
  - The `--font-sans` token reproduces the v3 `defaultTheme.fontFamily.sans` chain explicitly (Tailwind v4 no longer ships JS `defaultTheme` extension). Inlining the chain is safer than importing `tailwindcss/defaultTheme` (which is the v3 path).
  - All v3 utility names (`bg-primary`, `bg-primary-soft`, `text-default`, `text-default-strong`, `border-primary-accent`, `bg-terracotta-soft`, `text-mindaro`, `bg-muted-soft`, `bg-success-soft`, etc.) continue to compile because Tailwind v4 derives utility names from CSS variable names automatically.
- `@apply` inside scoped Astro `<style>` blocks: in Tailwind v4, `@apply` only sees `@theme` tokens (custom colour names like `text-primary-strong`) when the style block is "anchored" to the project CSS via a `@reference "../styles/global.css";` directive at the top.
  - `BookingForm.astro` and `TableOfContents.astro` reference project tokens (`bg-primary-soft`, `text-primary`, `text-primary-strong`) — these MUST have `@reference` added.
  - `LandingLayout.astro` only `@apply`s standard Tailwind utilities (`mx-auto`, `max-w-3xl`, `list-disc`, `text-2xl`, `font-bold`, `hidden`) that are not gated on `@theme`. Adding `@reference` is harmless but not strictly required; add it anyway for consistency so a future contributor doesn't introduce a project token in this file and forget the directive.
- `prettier.config.mjs` currently does not pin a Tailwind stylesheet; add `tailwindStylesheet: "./src/styles/global.css"` so `prettier-plugin-tailwindcss@^0.7.2` keeps sorting utility classes in the same canonical order under v4. **Sequence matters:** add this config entry to `prettier.config.mjs` BEFORE the first `pnpm format` run after the Tailwind v4 install. Running format without it can re-sort existing class lists under v3 heuristics, producing a misleading diff that gets confused with substantive changes.
- After install, run `pnpm format` once and commit any whitespace-only churn separately so the substantive diff is reviewable.
- Performance: Tailwind v4's Vite plugin compiles once per dev/build. No hot-path concern; nothing to memoise.
- Parsimony: the project has no Tailwind unit tests today; visual smoke tests in TS-003 are the behavioural contract. No test files added.

**Definition of Done:**

- [ ] `pnpm install` exits 0; no peer-dep error from `@astrojs/tailwind`.
- [ ] `pnpm build` exits 0 on Astro 5 with Tailwind v4.
- [ ] `tailwind.config.cjs` no longer present in the repo.
- [ ] `prettier.config.mjs` includes `tailwindStylesheet: "./src/styles/global.css"`, added before any `pnpm format` run.
- [ ] `pnpm format:check` exits 0 (proves the prettier plugin is sorting under v4 heuristics consistently).
- [ ] Each of the four affected pages (`/`, `/blog/bank-rule-activity-report/`, `/brand-kit/`, `/privacy-policy/`) renders visually identical to its pre-upgrade snapshot in Claude Code Chrome (TS-003 steps 1, 4 and TS-002 step 2 also pass).
- [ ] `prose` typography on `/privacy-policy/` and on the blog post body still applies (font, link colour, blockquote styling, list spacing all match baseline).
- [ ] No Tailwind v4 console warnings about unresolved utilities, missing `@theme`, or `@apply` outside `@reference`.

**Verify:**

- `pnpm install && pnpm format:check && pnpm build`
- Claude Code Chrome: snapshot home, blog index, blog detail, brand-kit, privacy-policy at desktop and mobile widths; diff against Task 1 baselines.

### Task 4: Run `@astrojs/upgrade` and resolve the dependency bump

**Objective:** Bump Astro 5 → 6 and the official integrations the tool manages, in one mechanical step. The codebase is now compliant with v6's removed/legacy APIs (Tasks 2 and 3), so this should be a clean version bump.

**Dependencies:** Task 2, Task 3.
**Mapped Scenarios:** TS-001.

**Files:**

- Modify: `package.json`, `pnpm-lock.yaml` (output of `@astrojs/upgrade`)
- Modify: `astro.config.mjs` only if the upgrade tool surfaces a config-shape change required by the new versions

**Trivial:** Omit.

**Key Decisions / Notes:**

- Run `pnpm dlx @astrojs/upgrade` from the repo root. The tool will detect `astro`, `@astrojs/mdx`, and `@astrojs/sitemap` and propose updates. `@astrojs/tailwind` is already gone, so the tool won't see it.
- **Expected version proposals** (verified against the npm registry at planning time, 2026-05-06):
  - `astro`: `^5.17.2` → `^6.2.2` (major bump from 5.x to 6.x)
  - `@astrojs/mdx`: `^4.3.13` → `^5.0.4` (major bump from 4.x to 5.x; v5 declares `peerDependencies.astro: ^6.0.0`)
  - `@astrojs/sitemap`: `^3.7.0` → `^3.7.2` (patch only; sitemap's 3.x line is already v6-compatible because the package does not pin a peer-dep)
- Confirm the proposed versions match these expectations before accepting. If the tool proposes a different major for any of them, stop and check the CHANGELOG for newly-introduced breaking changes that aren't covered by this plan.
- After the tool finishes:
  - `pnpm install` to refresh the lockfile if the tool didn't.
  - `pnpm dev` once and confirm the server starts cleanly (catches config-shape errors immediately).
  - `pnpm build` to confirm the static build still produces every page.
- If `@astrojs/upgrade` fails or refuses, fall back to manual edits: set `astro` to `^6.2.2`, `@astrojs/mdx` to `^5.0.4`, `@astrojs/sitemap` to `^3.7.2`, then `pnpm install`.
- Commit the dependency diff and the lockfile churn in this single task.

**Definition of Done:**

- [ ] `pnpm list astro` reports `astro@6.x.y` (≥ 6.2.2 at the time of planning; later patches are fine).
- [ ] `pnpm list @astrojs/mdx` reports `@astrojs/mdx@5.x.y` (≥ 5.0.4).
- [ ] `pnpm list @astrojs/sitemap` reports `@astrojs/sitemap@3.x.y` (≥ 3.7.2).
- [ ] `pnpm install` exits 0 with no peer-dep error.
- [ ] `pnpm build` exits 0 against Astro 6.
- [ ] No new deprecation warnings printed during build for any feature this codebase uses.

**Verify:**

- `pnpm install && pnpm build && pnpm list astro @astrojs/mdx @astrojs/sitemap @tailwindcss/vite tailwindcss`

### Task 5: Post-upgrade Zod and deprecation cleanup

**Objective:** Sweep for the small set of v6-deprecated APIs and confirm none survived. Most of these were removed in Task 2; this task is the audit.

**Dependencies:** Task 4.
**Mapped Scenarios:** TS-001.

**Files:**

- Modify: any file the audit catches (expected: none, given Tasks 2 and 3 already cover the surface area)

**Trivial:** Omit.

**Key Decisions / Notes:**

- Run these searches and confirm zero hits in `src/`:
  - `Astro.glob(`
  - `from "astro:schema"` and `import { z } from "astro:content"`
  - `<ViewTransitions`
  - `entry.render()` and `entry.slug`
  - `emitESMImage(`
  - `import.meta.env.ASSETS_PREFIX`
  - `legacy.collections`, `legacy.collectionsBackwardsCompat` in `astro.config.mjs`
- Confirm `astro.config.mjs` has no `experimental` block; if `@astrojs/upgrade` left an empty one, remove it.
- Check `src/components/StatsContainer.astro:120`: `import.meta.env.PUBLIC_STATS_API_URL` is a `PUBLIC_*` string variable, so v6's "always inlined, never coerced" rule is a no-op here. No change required, but document the verification.
- If the audit finds an unexpected hit (e.g. a pattern introduced by the upgrade tool), fix it inline; auto-fix without asking is in scope per the spec workflow rules.

**Definition of Done:**

- [ ] All eight greps return zero hits.
- [ ] `astro.config.mjs` has no `experimental` or `legacy` block.
- [ ] `pnpm build` exits 0 with no deprecation warnings.

**Verify:**

- `for p in 'Astro.glob(' 'from "astro:schema"' 'import { z } from "astro:content"' '<ViewTransitions' 'entry.render()' 'entry.slug' 'emitESMImage(' 'import.meta.env.ASSETS_PREFIX' 'legacy.collections'; do echo "=== $p ==="; grep -rn -- "$p" src/ astro.config.mjs 2>/dev/null; done`
- `pnpm build`

### Task 6: Verify build, format, link check, and visually smoke-test all page templates

**Objective:** End-to-end verification of the whole upgrade. Establish that the production build is clean, every URL still resolves, and every distinct page template renders without a visible regression.

**Dependencies:** Task 5.
**Mapped Scenarios:** TS-001, TS-002, TS-003, TS-004, TS-005.

**Files:**

- Modify: none (verification only).

**Trivial:** Omit.

**Key Decisions / Notes:**

- Run the full quality gate: `pnpm format:check && pnpm build && pnpm check-links`. All three must exit 0.
- Smoke-test the following page templates in Claude Code Chrome (any tier 1 browser MCP). The list is exhaustive against `src/pages/` after de-duplicating templates with identical structure:
  - `/` (home — uses Layout, navbar, hero, footer)
  - `/bank-reconciliation/` (product page; StatsContainer renders)
  - `/capture/` (product page)
  - `/blog/` (paginated index)
  - `/blog/bank-rule-activity-report/` (detail; uses `Picture`, `render(entry)`)
  - `/brand-kit/` (brand-token visual reference)
  - `/privacy-policy/` (MDX + MdLayout + TOC)
  - `/cookie-policy/`, `/terms-and-conditions/`, `/acceptable-use-policy/`, `/bank-rec-security-and-privacy/` (other MDX pages — quick visual pass; spot-check one)
- For each page: snapshot, click any primary CTA or link visible in the snapshot, re-snapshot, confirm new state. (See `browser-automation.md` rule: load + interact + re-snapshot is the contract for "verified".)
- Run `pnpm check-links` last. If it surfaces a broken internal link that was already broken pre-upgrade, document it but do not fix in this PR (out of scope).
- Mobile viewport: resize to 375×800 on home and Capture; confirm responsive layout, mobile navbar.
- Risk audit: walk back through the mitigations table; for each, identify the verification step that exercised it.

**Definition of Done:**

- [ ] `pnpm format:check` exits 0.
- [ ] `pnpm build` exits 0; no deprecation warnings.
- [ ] `pnpm check-links` exits 0.
- [ ] Every page template above renders in a browser; primary CTAs clicked; re-snapshot confirms expected state.
- [ ] Visual diff vs Task 1 baselines shows no regression on `/`, `/blog/bank-rule-activity-report/`, `/brand-kit/`, `/privacy-policy/`.
- [ ] Risk-mitigation table walked back; every "Mitigation" cell has a corresponding verification observation.

**Verify:**

- `pnpm format:check && pnpm build && pnpm check-links`
- Claude Code Chrome: navigate the eight pages above, snapshot + interact + re-snapshot each.

## Open Questions

None at planning time. The Tailwind direction and URL-preservation policy were resolved via the clarification batch.

## Deferred Ideas

- **Adopt Astro 6's now-stable `experimental.fonts` API.** The site currently uses `@fontsource-variable/rethink-sans`; switching to Astro's font helper would centralise font handling but is unrelated to the upgrade.
- **Adopt Content Layer live collections.** Useful when a CMS or external data source replaces the file-based blog; not relevant while there is one MDX entry.
- **Re-enable a strict CSP via Astro 6's `security.csp` config.** The responsive-image change in v6 (data-* attributes instead of inline styles) makes a CSP feasible without `style-src 'unsafe-inline'`. Worth a follow-up.
- **Author types for `getStaticPaths` props.** `[...page].astro` uses an inferred `paginate` parameter; explicitly typing it would catch the v6 "no number params" change at compile time even though we don't currently emit number params.
