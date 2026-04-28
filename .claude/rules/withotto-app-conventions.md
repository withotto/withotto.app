---
description: Component, layout, integration and content conventions specific to withotto.app v2.
---

# withotto.app Conventions

Tribal knowledge not obvious from reading a single file. Read before touching layouts, content, forms, or embeds.

## Layouts: Four Roles

| Layout                | Used by                           | Notes                                                                                                                                                                                                                                                                       |
| --------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RootLayout.astro`    | Never directly, wrapped by others | Sets `<head>`, SEO (`astro-seo`), fonts, canonical, default OG image. Title suffix is `" — With Otto"`.                                                                                                                                                                     |
| `Layout.astro`        | `.astro` pages                    | Wraps `RootLayout` + `Navbar` + `Footer`. The default for pages.                                                                                                                                                                                                            |
| `MdLayout.astro`      | Legal/policy `.mdx` pages         | Used via MDX frontmatter `layout: "layouts/MdLayout.astro"`. Renders Tailwind `prose`, Table of Contents, optional `lastUpdated` date, optional `pdfFilename` download link (resolves to `/files/<name>` under `public/`). Receives `{ frontmatter, headings }` from Astro. |
| `LandingLayout.astro` | (currently unused)                | Accepts `frontmatter.title / subtitle / affiliateProgramId / seo`. Kept for future landing pages. Safe to reuse, but not safe to delete without checking.                                                                                                                   |

**MDX `layout:` frontmatter**: Astro auto-passes `frontmatter` and `headings` to the layout. Do not re-declare these as props in MDX.

## Affiliate Program Threading

`affiliateProgramId` is threaded Page → `Layout` → `RootLayout` → `BookingForm`. The booking embed reads `ref` from `window.affiliateId` or query param and appends it to `data-query`. Preserve this prop name and chain.

## Content Collections: Blog

- **Location:** `src/content/blog/<category>/<YYYY-MM-DD-slug>.mdx`. Only `product-updates/` has posts today; `industry-insights/` is an empty scaffold.
- **Schema:** `src/content/config.ts` (Zod). Required: `draft, title, excerpt, image, imageAlt, imageDescription, publishDate, category, tags`. Optional: `slug` (overrides filename), `imageCredit`, `imageCreditUrl`, `audioFile`.
- **Slug generation:** `src/utils/blog.ts → getBlogSlug(entry)` strips the `YYYY-MM-DD-` filename prefix, or uses `frontmatter.slug` if present. Use this helper. Do not re-derive URLs manually.
- **`category` is a display string** (e.g. `"Product Updates"`), not the folder key. Folder key is recovered via `getBlogFolder(entry)`.
- **Images in frontmatter** use a project-root path like `/src/assets/blog/product-updates.jpg`. Astro's `image()` helper resolves them at build time. Do not put blog images in `public/`.
- **Audio files:** `frontmatter.audioFile` refers to files under `public/audio/` (rendered by `AudioPlayer.astro`).

## Interactive Components: Astro Scripts

- Default `<script>` blocks are bundled by Vite and scoped to the page. Use these for page-owned behaviour (e.g. newsletter dialog logic).
- Use `<script is:inline>` for third-party embed scripts (external `src`); they must not be processed by Vite.
- Use `define:vars={{ ... }}` on `is:inline` scripts to inject server-side values (e.g. `affiliateId`). Do not concatenate strings into the script body.
- **Custom elements:** `StatsContainer.astro` registers `<stats-container>` via `customElements.define`. The pattern is: server-render skeleton with `data-state="loading|error|content"` children, then the custom element swaps visibility after fetching. Reuse this pattern for other dynamic widgets.

## Third-Party Integrations: Self-Hosted Subdomains

| Service    | Endpoint                                                             | Component                                  |
| ---------- | -------------------------------------------------------------------- | ------------------------------------------ |
| Bookings   | `https://bookings.withotto.app` (+ `/embed.js`)                      | `BookingForm.astro`                        |
| Newsletter | `https://newsletter.withotto.app/subscription/form` (Listmonk-style) | `ui/NewsletterSignup.astro`                |
| Stats API  | `PUBLIC_STATS_API_URL` → Supabase edge fn `reconciliation-stats`     | `StatsContainer.astro` + `StatsGrid.astro` |

Swap embed URLs here; they are not configurable via env var.

## Icons

- **Remote set:** `astro-icon` + `@iconify-json/hugeicons`. Example: `<Icon name="hugeicons:calendar-03" size={32} class="..." />`
- **Local SVGs:** `src/components/ui/icons/index.js` exports SVG strings. Render with `<Fragment set:html={IconName} />` (e.g. `Circles` decorative pattern in Hero).

## Tailwind: Project Tokens

- **Brand colours** are defined in `tailwind.config.cjs`. Canonical palette and copy-friendly hex values live on the `/brand-kit/` page (`src/pages/brand-kit.astro`). Use semantic Tailwind utilities (`bg-primary`, `text-primary-strong`, `border-primary-accent`, `bg-terracotta-soft`, etc.); do not hardcode hex values in components. Token shape: each colour has `.soft / .DEFAULT / .strong` (some also `.accent / .medium`).
- **Font:** `font-sans` is `"Rethink Sans Variable"` (loaded via `@fontsource-variable/rethink-sans` in `RootLayout`).
- **Typography plugin:** Use `prose` / `md:prose-lg` for long-form text. Customise with `prose-li:mt-0` etc.
- **Form validation pattern:** Forms add a `validated` class on first submit attempt, then CSS targets `[.validated_&]:invalid:...` to reveal error messages. Preserve this pattern when adding new forms.

## Redirects & Legacy URLs

Managed in `_redirects` (Netlify). Do **not** create pages for these paths; redirects will not fire if a real page exists:

- `/business/`, `/trial/` → `/bank-reconciliation/`
- `/notebook/*` → `/bank-reconciliation/` (old campaign/landing pages; `src/pages/notebook/` is intentionally empty and excluded from the sitemap in `astro.config.mjs`)
- `/privacy-and-security/` → `/bank-rec-privacy-and-security/`

All redirects use `301`. Any new removals should mirror this pattern.

## SEO Defaults

- Default title: `"With Otto — Transform bank reconciliation from tedious to effortless with your new AI assistant"`. When a page passes `title`, it becomes `<title> — With Otto`.
- Default OG image: `/opengraph.png` (in `public/`).
- Landing pages that should NOT be indexed pass `seo={{ noindex: true }}` (see commit `e74c8a6`).
- Never hand-roll `<meta>` tags. Extend the `seo` prop instead.

## Pitfalls

- **Trailing slashes are mandatory** (`trailingSlash: "always"`). Links to `/foo` get a redirect; write `/foo/`.
- **`public/` vs `src/assets/`**: `public/` is copied verbatim and served from `/`; `src/assets/` goes through Astro's image pipeline. Blog images and anything needing responsive `srcset` must live in `src/assets/`.
- **pnpm is pinned** (`engines.pnpm: 10.x`, `packageManager: pnpm@10.15.0`). Do not commit a `package-lock.json` or `yarn.lock`.
- **Deno runtime in `supabase/functions/`**: do not import Node-style packages; use `jsr:` / `npm:` / `https://esm.sh/...` imports only.
