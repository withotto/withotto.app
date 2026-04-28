# Project: withotto.app (v2)

**Last Updated:** 2026-04-27

## Overview

Marketing website for With Otto, a multi-product brand making focused automation tools for accountants and bookkeepers. Static Astro site deployed to Netlify at https://withotto.app, backed by Supabase edge functions for public stats.

**Two products, different lifecycle stages:**

| Product                            | Status                                              | Landing                               | Notes                                                                                                                                                                        |
| ---------------------------------- | --------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Otto Capture** (receipt capture) | In beta, active development                         | `src/pages/capture/index.astro`       | Foreground product. Active dev since Jan 2026, beta started April 2026, full launch targeted late Q2 / early Q3 2026. Marketing claims need a "beta" qualifier until launch. |
| **Bank Reconciliation** (ML)       | Closed to new signups; existing customers supported | `src/pages/bank-reconciliation.astro` | Maintenance-only. Trial bookings removed. Old `/business/`, `/trial/`, `/notebook/*` URLs redirect here. Do not add new signup/trial CTAs.                                   |

Homepage and shared copy should lead with the brand (tools for accountants/bookkeepers) and foreground Otto Capture. New product pages should follow the pattern of `src/pages/capture/index.astro`, a discrete per-product landing sharing the common Navbar/Footer.

## Technology Stack

- **Framework:** Astro 5 (static site, `trailingSlash: "always"`)
- **Language:** TypeScript (strictNullChecks) + `.astro` components
- **Styling:** Tailwind CSS 3 via `@astrojs/tailwind` (+ `@tailwindcss/typography`)
- **Content:** MDX via `@astrojs/mdx`, Astro content collections
- **Icons:** `astro-icon` + `@iconify-json/hugeicons`
- **SEO:** `astro-seo`, `@astrojs/sitemap`
- **Backend:** Supabase edge functions (Deno) in `supabase/functions/`
- **Package manager:** pnpm 10.x (pinned via `packageManager` + `engines`; also installable via `mise`)
- **Formatter:** Prettier 3 with `prettier-plugin-astro` + `prettier-plugin-tailwindcss` (2-space indent)
- **Link checker:** `lychee` (via `check-links` script)
- **Hosting:** Netlify (redirects in `_redirects`)

No test framework, no ESLint, no CI config in repo. Quality gate is `format:check` + `check-links`.

## Directory Structure

```
.
├── src/
│   ├── pages/          # Routes (.astro + .mdx). [slug].astro for dynamic pages.
│   ├── layouts/        # RootLayout, Layout, LandingLayout, MdLayout
│   ├── components/     # Reusable .astro components (home/, navbar/, faq/, ui/, blog/, brand-kit/)
│   ├── content/        # Content collections — schema in src/content/config.ts
│   │   └── blog/       # Subfolders: industry-insights/, product-updates/
│   ├── assets/         # Images referenced from content/components (blog/, testimonials/)
│   ├── utils/          # Pure TS helpers (blog.ts)
│   ├── types/          # Shared TS types
│   └── styles/
├── public/             # Static assets served as-is
├── supabase/
│   ├── functions/      # Deno edge functions (e.g. reconciliation-stats)
│   └── config.toml
├── astro.config.mjs
├── tailwind.config.cjs
├── prettier.config.mjs
└── _redirects          # Netlify redirect rules
```

## Path Aliases (tsconfig)

Use these aliases in imports. Do not write relative `../../` paths:

| Alias           | Resolves to        |
| --------------- | ------------------ |
| `@lib/*`        | `src/lib/*`        |
| `@utils/*`      | `src/utils/*`      |
| `@components/*` | `src/components/*` |
| `@layouts/*`    | `src/layouts/*`    |
| `@assets/*`     | `src/assets/*`     |
| `@pages/*`      | `src/pages/*`      |

## Development Commands

| Task               | Command                                                          |
| ------------------ | ---------------------------------------------------------------- |
| Install deps       | `pnpm install`                                                   |
| Dev server         | `pnpm dev` (or `pnpm start`)                                     |
| Build              | `pnpm build`                                                     |
| Preview build      | `pnpm preview`                                                   |
| Format (write)     | `pnpm format`                                                    |
| Format (check)     | `pnpm format:check`                                              |
| Check broken links | `pnpm check-links` (builds then runs lychee on `dist/**/*.html`) |
| Raw Astro CLI      | `pnpm astro <cmd>`                                               |
| Supabase CLI       | `pnpm supabase <cmd>` (dev dep, use via pnpm)                    |

**Always use `pnpm`.** Do not introduce `npm` or `yarn` commands; the repo is pinned to pnpm 10.x.

## Conventions

- **Components:** `.astro` files. Named exports for helper types (e.g. `export interface Props`). Use `Astro.props` destructuring.
- **Layouts:** Nest `Layout` → `RootLayout`. `Layout` adds Navbar + Footer; `RootLayout` handles `<head>` and SEO.
- **SEO:** Pages pass `title` and optional `seo?: Partial<SEOProps>` to `Layout`.
- **Content collections:** Blog entries are MDX in `src/content/blog/<category>/<YYYY-MM-DD-slug>.mdx`. Schema defined in `src/content/config.ts` (Zod). Clean URL slugs derived by `src/utils/blog.ts` (`getBlogSlug` strips the date prefix).
- **Images:** Use Astro's `image()` helper in content schemas. Site defaults to `layout: "constrained"` with `responsiveStyles: true`.
- **Legal / policy pages:** `.mdx` under `src/pages/` (privacy-policy, cookie-policy, terms-and-conditions, acceptable-use-policy, bank-rec-security-and-privacy).
- **Formatting:** Always 2-space, no tabs, `bracketSameLine: true`. Run `pnpm format` before committing.
- **trailingSlash: always**: internal links must end with `/` to avoid Netlify redirects.
- **Sitemap:** `/notebook/` URLs are excluded from the sitemap filter (see `astro.config.mjs`).

## Supabase Edge Functions

- Location: `supabase/functions/<fn-name>/index.ts`, shared helpers in `supabase/functions/_shared/`.
- Runtime: Deno (`Deno.serve`, `jsr:` imports, `Deno.env.get`).
- Use `corsHeaders` from `_shared/cors.ts` on all responses.
- Public API schema lives on Supabase schema `api` (not `public`); pass `db: { schema: "api" }` to `createClient`.
- Cache responses with `Cache-Control` headers where appropriate (edge fns are hit from the browser).

## Environment Variables

- `.env.development` holds local dev values. Never commit `.env.production` or secret keys.
- Public stats endpoint: `PUBLIC_STATS_API_URL` (browser-exposed; `PUBLIC_` prefix required by Astro).
- Supabase: `PROD_SUPABASE_URL`, `PROD_SUPABASE_ANON_KEY` (anon key only; never ship service-role keys to the site bundle).

## Redirects

Defined in `_redirects` (Netlify syntax). Old/removed pages and legal slugs should be mirrored here, not handled in-app.
