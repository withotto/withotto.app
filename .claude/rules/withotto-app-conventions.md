---
description: Component, layout, integration and content conventions specific to withotto.app v2.
---

# withotto.app Conventions

Tribal knowledge not obvious from reading a single file. Read before touching layouts, content, forms, or embeds.

## Layouts: Five Roles

| Layout                    | Used by                                                                                                                                                                    | Notes                                                                                                                                                                                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RootLayout.astro`        | Never directly, wrapped by others                                                                                                                                          | Sets `<head>`, SEO (`astro-seo`), fonts, canonical, default OG image. Title suffix is `" — With Otto"`.                                                                                                                                                                     |
| `Layout.astro`            | `.astro` pages                                                                                                                                                             | Wraps `RootLayout` + `Navbar` + `Footer`. The default for pages.                                                                                                                                                                                                            |
| `MdLayout.astro`          | Legal/policy `.mdx` pages                                                                                                                                                  | Used via MDX frontmatter `layout: "layouts/MdLayout.astro"`. Renders Tailwind `prose`, Table of Contents, optional `lastUpdated` date, optional `pdfFilename` download link (resolves to `/files/<name>` under `public/`). Receives `{ frontmatter, headings }` from Astro. |
| `CapturePageLayout.astro` | Otto Capture subpages (`/capture/xero/`, `/capture/freeagent/`, `/capture/quickbooks/`, `/capture/for-businesses/`) and the comparison pages (`/capture/vs-<competitor>/`) | Wraps `Layout`. Takes `title`, `description` and the `breadcrumbs` trail, renders the visible breadcrumbs, and builds the BreadcrumbList JSON-LD (plus the SoftwareApplication with `softwareApplication`). Open each page with `CaptureHero`.                              |
| `LandingLayout.astro`     | (currently unused)                                                                                                                                                         | Accepts `frontmatter.title / subtitle / affiliateProgramId / seo`. Kept for future landing pages. Safe to reuse, but not safe to delete without checking.                                                                                                                   |

**MDX `layout:` frontmatter**: Astro auto-passes `frontmatter` and `headings` to the layout. Do not re-declare these as props in MDX.

## Affiliate Program Threading

`affiliateProgramId` is threaded Page → `Layout` (or `LandingLayout`, from its frontmatter) → `RootLayout`, which loads the Pushlap affiliate tracker with that program ID. No page passes one today. Separately, `BookingForm` (on `/bank-reconciliation/`) takes an `affiliateId` prop, falls back to `window.affiliateId`, and appends it as `ref` to the booking embed's `data-query`. Preserve both prop names and the chain.

## Content Collections: Blog

- **Location:** `src/content/blog/<category>/<YYYY-MM-DD-slug>.md` or `.mdx`, under `industry-insights/` or `product-updates/`. Use `.mdx` when the post imports a component.
- **Schema:** `src/content.config.ts` (Zod). Required: `draft, title, excerpt, image, imageAlt, imageDescription, publishDate, category, tags`. Optional: `slug` (overrides filename), `imageCredit`, `imageCreditUrl`, `audioFile`.
- **Slug generation:** `src/utils/blog.ts → getBlogSlug(entry)` strips the `YYYY-MM-DD-` filename prefix, or uses `frontmatter.slug` if present. Use this helper. Do not re-derive URLs manually.
- **Per-post routes:** every route built once per post (`blog/[slug].astro`, `blog/[slug]/og.jpg.ts`) exports `getBlogPostPaths` from `src/utils/blog.ts` as its `getStaticPaths`, so they are generated from the same posts. A new per-post route does the same.
- **`category` is a display string** (e.g. `"Product Updates"`), not the folder key. Folder key is recovered via `getBlogFolder(entry)`.
- **Images in frontmatter** use a project-root path like `/src/assets/blog/product-updates.jpg`. Astro's `image()` helper resolves them at build time. Do not put blog images in `public/`.
- **Audio files:** `frontmatter.audioFile` refers to files under `public/audio/` (rendered by `AudioPlayer.astro`).

## Comparison Pages

Each Otto Capture comparison page (`/capture/vs-<competitor>/`) compares Capture with one named competitor. What makes a comparison fair, what counts as evidence and how it stays accurate are set by the shared `comparisons.md` (synced into `.claude/rules/shared/`). This is how this repo carries it out:

- **One data file per competitor:** `src/content/competitors/<slug>.yaml`, the `competitors` collection, whose schema is `competitorSchema` in `src/lib/compare.ts` (loaded by `src/content.config.ts`), so `pnpm test:site` tests it. The file's name is the page's slug. Every claim, prose fact and scenario price the file gives has a `value`, `sourceUrl`, `sourceName`, `checked` date and `quote`, so a missing field fails the build. Claim, scenario and price-option keys must be ones `src/lib/compare.ts` defines, so a typo in one fails the build too; `facts` and `inputs` take keys of the file's own choosing, and a row or price the file leaves out shows "Not stated". `sourceUrl` must be https, since it becomes a link on the page. `checked` is a quoted date, since YAML turns an unquoted impossible one (2026-11-31) into the next month's, and a price is in whole pence. Facts a page states in prose but not in the table go in the file's `facts` map. Each price records the scenario volumes it was read for (`volumes`) and, for a competitor charging per document received, the received ratio (`receivedPerHundred`): changing either in `compare.ts` fails the build until the competitor's prices are read again. `not published` is the value for anything the competitor doesn't publish. The folder's `README.md` tells vendors how to send a correction.
- **One shared model:** `src/lib/compare.ts` holds the comparison rows (with Capture's side of each), the pricing scenarios, and the helpers that join a data file to them. Scenarios are groups of clients at exact monthly volumes, the same on every page. Each competitor price comes in up to four options (no commitment or the cheapest commitment, each without or with line items), and the page switches line items with a CSS-only radio toggle. Capture's side comes from the site's own facts: its scenario totals from `captureTotal()` over `clientCost()` in `@lib/capture-estimate`, never from figures typed into a page.
- **One page file per competitor,** using `CapturePageLayout` and the components in `src/components/compare/`. No dynamic `[competitor].astro` route: a template that only swaps the name is a doorway page. Every fact about the competitor in a page's prose goes through `Claim`, which takes a key from the data file's `claims` or `facts`; prose without one states only our own view or Capture's facts.
- **Every date goes through `CheckedOn`,** which renders a `time` element carrying `data-claim-checked`. That is what the SEO check's `claim-stale` rule reads (see Site Checks).
- **Links to comparisons come from the collection.** `ComparisonLinks` lists each competitor whose data file sets `published: true`, and renders nothing, heading included, when there are none. A comparison page passes `current` to leave itself out.
- **Evidence and drift checks live in the private content repo:** the dated copies of each source, the tool that captures them and renews `checked` dates, and the monthly drift run. This repo holds only the public facts.
- **Capture's own usage figures** (`mixedLinesUsage` and `receivedUsage` in `src/lib/compare.ts`) are measured from Capture's production data with aggregate-only queries kept in the private content repo, never here. Their dates go through `CheckedOn`, so they are re-measured on the claim-age cycle. Discard reasons have been recorded in Capture since 10 November 2026; when re-measuring, check the near-duplicate estimate behind `without-near-duplicates` against them.
- **Retiring a comparison** means deleting its page and its data file, with no redirect (see Redirects & Legacy URLs).

## Interactive Components: Astro Scripts

- Default `<script>` blocks are bundled by Vite and scoped to the page. Use these for page-owned behaviour (e.g. newsletter dialog logic).
- Use `<script is:inline>` for third-party embed scripts (external `src`); they must not be processed by Vite.
- Use `define:vars={{ ... }}` on `is:inline` scripts to inject server-side values (e.g. `affiliateId`). Do not concatenate strings into the script body.
- **Custom elements:** `StatsContainer.astro` registers `<stats-container>` via `customElements.define`. The pattern is: server-render skeleton with `data-state="loading|error|content"` children, then the custom element swaps visibility after fetching. Reuse this pattern for other dynamic widgets.
- **Progressive enhancement without a fetch:** `capture/PricingCalculator.astro` registers `<pricing-calculator>`. The server renders the finished calculator at a starting state with its controls `disabled`, so it reads as a worked example without JavaScript. The element enables the controls and updates that same markup in place, never rebuilding it, so nothing shifts when it takes over. The frontmatter and the script both import the arithmetic from `@lib/capture-estimate`, which keeps the two renders identical, and that module is tested by `pnpm test:site`. Copy the shape for any other interactive widget.
- **Capture pricing and VAT:** each tier card's unit line ends "excl. VAT" (`CapturePricing.astro`), so a page showing the cards carries no VAT line of its own. `priceUnitLabels` stays without it, because the SoftwareApplication Offers reuse it as `unitText`, and `valueAddedTaxIncluded` states the VAT there.

## Third-Party Integrations: Self-Hosted Subdomains

| Service    | Endpoint                                                             | Component                                  |
| ---------- | -------------------------------------------------------------------- | ------------------------------------------ |
| Bookings   | `https://bookings.withotto.app` (+ `/embed.js`)                      | `BookingForm.astro`                        |
| Live chat  | `https://chat.withotto.app` (+ `/packs/js/sdk.js`)                   | `ChatwootWidget.astro`                     |
| Newsletter | `https://newsletter.withotto.app/subscription/form` (Listmonk-style) | `ui/NewsletterSignup.astro`                |
| Stats API  | `PUBLIC_STATS_API_URL` → Supabase edge fn `reconciliation-stats`     | `StatsContainer.astro` + `StatsGrid.astro` |

Swap embed URLs here; they are not configurable via env var.

**Listmonk's public subscription endpoint takes only `email`, `name`, and list UUIDs** (`processSubForm` in listmonk's `cmd/public.go`), and sends no CORS headers. Any form that needs to store extra answers, or to show its own success and error states, has to go through a Supabase edge function that calls the authenticated admin API and writes the answers as subscriber `attribs`. The QuickBooks Online waitlist function did this until it was removed in October 2026; its code, and the Listmonk API user permissions it needed, are in git history.

**Chatwoot (live chat)** is rendered once in `RootLayout.astro` for every page, with no env-var gate: both the endpoint and the public website token live in `ChatwootWidget.astro`. See `.claude/rules/withotto-app-chatwoot.md` for how it works and the sales-oriented dashboard checklist. It replaced Intercom in August 2026.

## Icons

- **Remote set:** `astro-icon` + `@iconify-json/hugeicons`. Example: `<Icon name="hugeicons:calendar-03" size={32} class="..." />`
- **Local SVGs:** import the file from `src/assets/` with `?raw` and render it with `<Fragment set:html={svg} />` (e.g. the `Circles` pattern in `hero.astro`, from `assets/frame.svg?raw`), or import it without `?raw` to use it as a component (the footer's `Logo`). `src/components/ui/icons/index.js` exports a `Tick` component that nothing imports.

## Screenshots

Use `Screenshot.astro` for product/blog screenshots (zoomable, responsive, optional caption). Import the image from `src/assets/*` (it goes through Astro's image pipeline; see the `public/` vs `src/assets/` pitfall below):

```
// frontmatter
import Screenshot from "@components/Screenshot.astro";
import shot from "@assets/capture/step-01-capture.png";

// template
<Screenshot src={shot} alt="A receipt being submitted to Otto Capture" caption="Optional" />
```

- **Only `src` and `alt` are required.** `width`/`height` default to the image's intrinsic dimensions, so the box matches the source aspect ratio and the image is **not cropped**.
- **Do not pass `width`/`height` to "size" the image.** The site uses Astro `layout: "constrained"`, which applies `object-fit: cover` to whatever dimensions are in effect, so a width/height whose ratio differs from the source **crops** it. Pass both only when you deliberately want to crop to a fixed ratio.
- Layout/size on the page is controlled by the surrounding container (e.g. `max-w-4xl`), not by these props.

## Tailwind: Project Tokens

- **Brand colours** are defined in `src/styles/global.css` (Tailwind 4 `@theme` block, e.g. `--color-primary`, `--color-terracotta`). Canonical palette and copy-friendly hex values live on the `/brand-kit/` page (`src/pages/brand-kit.astro`). Use semantic Tailwind utilities (`bg-primary`, `text-primary-strong`, `border-primary-accent`, `bg-terracotta-soft`, etc.); do not hardcode hex values in components. Token shape: each colour has `.soft / .DEFAULT / .strong` (some also `.accent / .medium`).
- **Font:** `font-sans` is `"Rethink Sans Variable"` (loaded via `@fontsource-variable/rethink-sans` in `RootLayout`).
- **Typography plugin:** Use `prose` / `md:prose-lg` for long-form text. Customise with `prose-li:mt-0` etc.
- **Form validation pattern:** Forms add a `validated` class on first submit attempt, then CSS targets `[.validated_&]:invalid:...` to reveal error messages. Preserve this pattern when adding new forms.

## Buttons

**Never hand-roll button classes.** Every button and button-styled link on the site goes through one of two components, which share their styling via `src/components/ui/buttonStyles.ts`:

| Component                      | Renders    | Use for                               |
| ------------------------------ | ---------- | ------------------------------------- |
| `ui/link.astro` (`<Link>`)     | `<a href>` | Navigation and CTAs that go somewhere |
| `ui/button.astro` (`<Button>`) | `<button>` | Form submits and in-page actions      |

Both take the same `variant` and `size`, so a `<Link>` and a `<Button>` with matching props are visually identical. Extra props (`type`, `download`, `data-*`, `aria-*`) pass through to the element.

| `variant`  | Look                                             | Where it fits                                           |
| ---------- | ------------------------------------------------ | ------------------------------------------------------- |
| `primary`  | Solid `bg-primary`, white text (**the default**) | The main CTA on a page or in a form                     |
| `outline`  | `border-primary`, primary text, transparent fill | A second choice next to a primary                       |
| `inverted` | White fill, `text-primary-strong`                | On the brand-coloured bands, where solid green vanishes |
| `subtle`   | Neutral fill and border                          | Navigation rather than conversion (pagination, dismiss) |

| `size` | Padding     | Where it fits                       |
| ------ | ----------- | ----------------------------------- |
| `sm`   | `px-4 py-2` | Inside a card                       |
| `md`   | `px-6 py-3` | Standard page CTA (**the default**) |
| `lg`   | `px-8 py-4` | Hero CTAs and primary form submits  |

`block` makes it full width. One-off emphasis goes through the `class` prop rather than a new variant: `src/pages/capture/index.astro` does this for the two lifted hero CTAs (`heroCta`), which are deliberately the only lifted buttons on the site.

**Cursor:** Tailwind 4's preflight sets `cursor: default` on `<button>`, which would leave a `<button>` CTA behaving differently from a visually identical `<a>` CTA. A base-layer rule in `src/styles/global.css` restores `cursor: pointer` for every enabled `button`, `summary`, and `[role="button"]`. Utilities still override it, so `cursor-zoom-in` (the screenshot trigger) and `disabled:cursor-not-allowed` both work. Do not add `cursor-pointer` to individual buttons.

**Focus rings** are `focus-visible:` throughout, never `focus:`, so a ring appears on keyboard focus but not on mouse click. Match this in any new interactive control.

Dead components not on this system (`pricing-compare.astro`, `clients.astro`, `clients-alt.astro`, `solutions.astro`, `highlights.astro`) are imported nowhere. Migrate them if they are ever brought back into use.

## Site Checks

`scripts/checks/` holds the SEO and accessibility checks. They run over the built `dist/`, read site settings from `checks.config.mjs`, and write a versioned JSON report per check to the ignored `.checks/` folder. Each finding names its rule, route, source file and selector, and says what is wrong and what is expected; accessibility findings also link the axe rule. Each can be fixed from the finding alone.

- **Severity:** a11y serious and critical block; moderate, minor and best-practice warn. SEO blocks on:
  - title problems: missing, more than one, or shared with another page
  - H1 problems: missing or more than one
  - canonical problems: missing, more than one, not absolute, on another origin, without a trailing slash, or pointing at a page that was not built
  - JSON-LD that does not parse, or has an item without an `@context` or `@type`
  - sitemap problems: missing, unreadable, empty, or listing a URL with no built page
  - an indexable 404 page, and orphan pages
  - links without a trailing slash, and links to `_redirects` sources
  - a claim date (`data-claim-checked`) checked more than `claimAge.blockDays` (90) days ago, dated after today, or with no readable `datetime`

  SEO warns on title and description lengths, missing or duplicate descriptions, skipped heading levels, noindex pages in the sitemap, indexable pages missing from it, redirects shadowed by a real page, redirects to a page that does not exist, and claim dates checked more than `claimAge.warnDays` (45) days ago. `scripts/checks/seo.mjs` is the source of truth: each finding's rule and severity are set there, so check it rather than this list.

- **Baseline:** `checks-baseline.json` records existing block-level debt, keyed by rule and component (navbar, footer, table of contents), by rule and group (pages the check grouped itself, such as pages sharing a title), or by rule and route, each with a count. Only findings beyond it fail. It holds rule IDs, component names, group names and routes only.
- **Shrinking needs no approval:** `pnpm check:baseline --prune` removes entries the latest run no longer finds. Fixing debt should always end with a prune.
- **Growing needs Stuart's approval:** never run `--accept` to make a failing check pass. Fix the finding; if it truly cannot be fixed, propose the baseline change in the PR for Stuart to approve.
- **`claim-stale` is never baselined,** and the code enforces it (`NEVER_BASELINED` in `scripts/checks/lib/baseline.mjs`): `--accept` never writes it, a baseline file holding it fails to load, and an entry for it never covers a finding. It clears by re-checking the claim against its source and renewing its `checked` date in the competitor's data file, or by correcting the claim. For Capture's own usage figures it clears by measuring them again and renewing `measured` (and the figures) in `src/lib/compare.ts`. A blocking one stops every PR, Renovate's included, which is the point.
- **The accessibility check blocks Chatwoot and the bookings embed** (`blockedHosts`): a headless visit to Chatwoot would create a contact in the live sales inbox, and a slow bookings host would stall the page load. The SEO check never loads a page, and the link check only fetches URLs that appear in the built HTML, which never includes Chatwoot.
- **The link check reads the site's own URLs from the build.** `scripts/checks/links.mjs` remaps `https://withotto.app/…` to `dist/` and resolves each directory to its `index.html`, so a new page's canonical passes before it is deployed and a link to a page the change removes fails, even when pages below it remain. Netlify serves `/404/` from `404.html`, which has its own rule. Links to this repo's own files on GitHub (`repoUrl` in `checks.config.mjs`, `blob/main/` URLs) resolve against the working tree, so the PR that adds a competitor's data file passes before the file is on `main`.
- **Blog sources:** the build writes a route map (`src/pages/checks-route-sources.json.ts`, moved out of `dist/` by an integration in `astro.config.mjs`) so blog findings point at the post's own file. Do not delete either piece.

## Redirects & Legacy URLs

Managed in `public/_redirects` (Netlify). It must stay in `public/`: Netlify reads it only from the publish directory, `dist/`, and a copy at the repo root is never deployed. Do **not** create pages for these paths; redirects will not fire if a real page exists:

- `/business/`, `/trial/` → `/bank-reconciliation/`
- the old `/notebook/` campaign and landing pages → `/bank-reconciliation/` (each listed by path; `src/pages/notebook/` is intentionally empty and excluded from the sitemap in `astro.config.mjs`)
- `/privacy-and-security/`, `/bank-rec-privacy-and-security/` → `/bank-rec-security-and-privacy/`

Removed pages use `301`. Any new removals should mirror this pattern.

**Exception: comparison pages.** A retired comparison (`/capture/vs-<competitor>/`) is unpublished with no redirect: delete its page and its data file, which takes it out of the sitemap and every generated link. Use a `302` only if Stuart judges one necessary. Redirecting a comparison to `/capture/` would send a reader looking for a named competitor to a page that doesn't answer the question.

## SEO Defaults

- Default title: `"With Otto — practical software for accountants and bookkeepers"`. When a page passes `title`, it becomes `<title> — With Otto`.
- Default OG image: `/opengraph.png` (in `public/`), 1200x630. A page can pass its own as `ogImage={{ path, alt }}` to `Layout`. Each blog post does: `src/pages/blog/[slug]/og.jpg.ts` builds `/blog/<slug>/og.jpg` from the post's hero, cropped to 1200x630 with the white logo on a navy panel, so a new post gets one with no extra step.
- Landing pages that should NOT be indexed pass `seo={{ noindex: true }}` (see commit `e74c8a6`).
- Never hand-roll `<meta>` tags. Extend the `seo` prop instead.

### Page copy: how this site carries out the shared rules

What good titles, descriptions, headings, link text, alt text and structured data are, and the banned tactics, is set by `shared/accessible-copy.md` and `shared/search-pages.md`. Both are rendered from the private shared-rules repo on page paths. This is how this codebase carries them out:

- **Title:** pass a short `title` prop to `Layout`. `RootLayout` appends ` — With Otto` (12 characters), so the prop has roughly 18 to 48 of the 30 to 60. Never put "With Otto" in it.
- **Description:** `<Layout title="…" seo={{ description: "…" }}>`. `RootLayout` spreads `seo` over its defaults, so a page without one inherits the site-wide default. A blog post's `excerpt` is both its listing summary and its meta description (`src/pages/blog/[slug].astro` passes it as `seo.description`), so write it to the same standard. There is no separate description field.
- **Canonical:** never in the `seo` prop. `RootLayout` builds it from the page path and the site URL.
- **Structured data:** the `jsonLd` prop on `Layout`, one object or an array. `RootLayout` renders one `<script type="application/ld+json">` per object.
- **Headings:** marketing pages stop at H3 (voice rules). Pick the level for structure and style it with classes.
- **Alt text:** `Screenshot.astro` reuses its `alt` as the zoom button's accessible name and the zoom dialog's heading, so it takes informative images only and its `alt` is never empty. Blog frontmatter has `imageAlt` (a short phrase on the hero image) and `imageDescription` (a longer, screen-reader-only caption linked with `aria-describedby`); `imageAlt: ""` only for a genuinely decorative hero.
- **Internal links:** end in `/` (except downloads under `/files/`), never point at a path in `_redirects`, and every new page is linked from at least one other page.
- **Enforced by:** `check:seo` (titles, descriptions, canonicals, H1s and heading levels, JSON-LD, the sitemap, orphan pages, link form), `check:a11y` (link names, alt text, contrast, heading best practice), `check:links`, and Lighthouse on deploy previews. "Site Checks" says which findings block.

## Pitfalls

- **Trailing slashes are mandatory** (`trailingSlash: "always"`). Links to `/foo` get a redirect; write `/foo/`.
- **`public/` vs `src/assets/`**: `public/` is copied verbatim and served from `/`; `src/assets/` goes through Astro's image pipeline. Blog images and anything needing responsive `srcset` must live in `src/assets/`.
- **pnpm is pinned** to an exact 12.x in `packageManager`, the authority, and to the same version in `mise.toml`; Renovate bumps both together. pnpm records that version in `pnpm-lock.yaml` and switches to it itself, so do not add `engines.pnpm` (it only duplicates the pin and has broken Renovate's lockfile updates). Do not commit a `package-lock.json` or `yarn.lock`.
- **Deno runtime in `supabase/functions/`**: do not import Node-style packages; use `jsr:` / `npm:` / `https://esm.sh/...` imports only.
