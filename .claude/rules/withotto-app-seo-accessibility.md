---
paths:
  - "src/pages/**"
  - "src/components/**"
  - "src/layouts/**"
  - "src/content/**"
---

# SEO and accessibility: page copy

Rules for drafting and reviewing page copy on withotto.app so it is accessible and search-ready without gaming anything. Load alongside the voice rules (`shared/voice-common.md` and the page-type voice file), which own tone and wording. The page-brief skill reads this file explicitly, because a brief is written before any page file is opened and the `paths:` scoping would not load it.

Each rule says why it exists and what enforces it. The checks:

- `pnpm check:seo`: script over the built `dist/`. Titles, descriptions, canonicals, headings, JSON-LD, orphan pages, internal link form.
- `pnpm check:a11y`: axe-core in Playwright against WCAG 2.0, 2.1, and 2.2 A and AA. Serious and critical findings block; moderate, minor, and best-practice findings warn.
- Lighthouse on Netlify deploy previews: accessibility, SEO, and best-practices categories asserted.
- `pnpm check:links`: lychee over the build, for broken links and anchors.
- Manual: judgement at drafting and review. No check can tell whether copy is true or useful.

## Keep search research out of the repo

Target queries, keyword lists, and search volumes never go in this repo: not in copy, code comments, commit messages, PR text, or rules files. Examples in rules stay generic.

**Why:** the repo and its pull requests are public, and the research is ours. **Enforced by:** manual.

## One job and one search intent per page

Decide before drafting what the page is for and the one question a searcher brings to it. If two pages answer the same question, merge them or give each a distinct job. If one page tries to answer two, split it or drop one.

**Why:** a page with two jobs serves neither reader well, and two pages chasing one intent compete with each other and drift towards doorway pages (see banned tactics). **Enforced by:** manual (the page brief). `check:seo` catches one symptom: duplicate titles or descriptions.

## Titles written for people

Pass a short, specific `title` prop to `Layout`. `RootLayout` appends the brand, so `title="Otto Capture"` renders as `Otto Capture — With Otto`. Do not put "With Otto" in the prop.

- Describe what the page is, in the words the reader would use. Front-load the distinctive part.
- Unique across the site. Sentence case, per the voice rules.
- About 30 to 60 characters rendered. The suffix takes 12, so the prop has roughly 18 to 48.
- No lists of terms, no repeated phrases, no boilerplate shared across pages.

**Why:** the title is the headline in search results and the browser tab. Google rewrites titles that are stuffed, boilerplate, too long, or do not match the page, so a plain accurate title is the one that survives. **Enforced by:** `check:seo` (missing or duplicate blocks; length warns); Lighthouse SEO (document title present).

## Descriptions written for people

Pass the description through the `seo` prop: `<Layout title="…" seo={{ description: "…" }}>`. `RootLayout` spreads `seo` over its defaults, so this replaces the site-wide default description. A page that omits it inherits the default and duplicates every other page that did the same.

- One or two sentences saying what the reader will find, with a concrete fact where there is one.
- About 70 to 160 characters. Unique per page.
- For blog posts, the frontmatter `excerpt` is the summary shown on the blog listing. Write it to the same standard.

**Why:** search engines often show the description under the title. A specific one helps the reader choose; a duplicated default tells them nothing. **Enforced by:** `check:seo` (missing or duplicate blocks; length warns); Lighthouse SEO (meta description present).

## Canonicals come from the layout

Do not set `canonical` in the `seo` prop. `RootLayout` builds it from the page path and the site URL, absolute and with a trailing slash.

**Why:** a hand-set canonical that drifts from the real URL tells search engines to index a different page. **Enforced by:** `check:seo`.

## Heading order

- Exactly one H1 per page, saying what the page is. It usually matches the title prop.
- Nest in order: H2 under H1, H3 under H2. Never skip a level on the way down. Marketing pages stop at H3 (voice rules).
- Choose the level for structure, then style it with classes. Never pick `<h4>` because it looks the right size.
- Components that render headings (cards, FAQ items, feature grids) must fit the level of the section they sit in.

**Why:** screen reader users navigate by headings, and a skipped level implies missing content. Search engines use the same outline to understand the page. **Enforced by:** `check:seo` (one H1 blocks; skipped levels warn); `check:a11y` (`page-has-heading-one`, `heading-order` as best-practice warnings); Lighthouse accessibility.

## Link text

Meet WCAG 2.2 success criterion 2.4.4 Link Purpose (In Context), Level A: the purpose of each link is clear from its text plus its sentence, list item, or table cell. Aim for 2.4.9 Link Purpose (Link Only): clear from the link text alone.

- Link the words that name the destination: "see the [frequently asked questions](/faqs/)", not "[click here](/faqs/) for answers".
- No bare "learn more", "read more", or "here". If a card needs a short visual label, give the link an accessible name that includes the card's subject.
- Links with the same text go to the same place. Links to the same place use the same text.
- Icon-only links and buttons need an `aria-label` naming the action.
- Internal links end in `/` (except file downloads under `/files/`) and never point at a path listed in `_redirects`. Every new page is linked from at least one other page.

**Why:** screen reader users often pull up a list of links out of context, and everyone scans link text. Links through redirects waste a hop and signal a stale site; an unlinked page is hard for people and crawlers to find. **Enforced by:** `check:a11y` (`link-name` catches empty links); Lighthouse SEO (flags generic link text such as "click here"); `check:seo` (trailing slash, redirect sources, orphan pages); `check:links` (broken links and anchors); manual for wording.

## Alt text by image type

Follow the WAI images tutorial. Decide what job the image does, then write for that job.

| Image type     | What the alt text says                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Informative    | The information the image adds, in a short phrase. What it shows that matters to the text, not what it looks like. No "Image of" or "Screenshot of": screen readers announce that already. |
| Decorative     | Empty: `alt=""`, never omitted. Decorative inline SVGs get `aria-hidden="true"`.                                                                                                           |
| Functional     | The action or destination, not the picture. A logo linking home is "With Otto home", not "Otto logo".                                                                                      |
| Complex        | A short alt naming the chart or diagram, plus the full content in visible text nearby or a linked description.                                                                             |
| Images of text | Avoid them; use real text. Where unavoidable (a logo, a screenshot of UI), the alt carries the text that matters.                                                                          |

In this codebase:

- **`Screenshot.astro`** requires `alt`, and reuses it as the zoom button's accessible name ("View full size image: …") and as the heading of the zoom dialog. Its alt must never be empty and must read as a short title, so use `Screenshot` for informative images only. A decorative image does not go in a zoomable screenshot.
- **Blog frontmatter** (`src/content.config.ts`) has `imageAlt`, the short alt on the hero image, and `imageDescription`, a longer description rendered as a screen-reader-only caption linked with `aria-describedby`. Keep `imageAlt` to a phrase; put detail in `imageDescription`. Use `imageAlt: ""` only for a genuinely decorative hero.
- Alt text is not a place for search terms (see keyword stuffing below).

**Why:** alt text is the image for anyone who cannot see it, and the wrong kind (a description of a decorative flourish, the filename of a functional icon) is noise or a dead end. **Enforced by:** `check:a11y` (`image-alt`, `svg-img-alt`, `role-img-alt`, `image-redundant-alt`); Lighthouse accessibility; manual for whether the text is right for the type.

## Plain language

Short sentences, common words, one idea at a time. Define a term the first time a reader outside accounting might not know it. The voice rules set the detail; this rule is the accessibility reason for them.

**Why:** readers include people with cognitive disabilities, people reading in a second language, and busy practice staff skimming between jobs. Clear copy is also what search engines reward as helpful. **Enforced by:** manual.

## Structured data only where it is true

Pass JSON-LD through the `jsonLd` prop on `Layout` (one object or an array; `RootLayout` renders one `<script type="application/ld+json">` per object). Only mark up what a visitor can see on that page.

- `Organization`, `SoftwareApplication`, `BlogPosting`, and `BreadcrumbList` where they describe the page.
- `FAQPage` only when the questions and answers are visible on the page.
- `Offer` prices only when they match the visible pricing exactly.
- No `Review` or `AggregateRating` markup. We publish no independent ratings to describe.

**Why:** structured data that says something the page does not is a spam signal and a false claim, and can lose rich results for the whole site. **Enforced by:** `check:seo` (every block parses and has `@context` and `@type`); manual for truthfulness.

## Banned tactics

None of these, in copy, markup, alt text, or structured data. Each is named in Google's spam policies, dishonest to the reader, or both.

- **Keyword stuffing:** repeating a phrase or packing lists of terms into copy, titles, alt text, or footers. It reads as spam to people and is a named spam policy violation.
- **Hidden text and links:** text meant for search engines but not people (white on white, off-screen, zero size, behind an element). It deceives the reader and is a named spam policy violation. Screen-reader-only text that describes or labels visible content is accessibility, not hidden text.
- **Doorway pages:** near-duplicate pages per town, platform, or phrase that exist to rank and funnel to one page. A platform page earns its place only with content that genuinely differs. Named spam policy violation.
- **Invented reviews, ratings, or testimonials:** anything not from a real, identifiable customer, including made-up counts ("trusted by thousands"). It is dishonest, violates Google's policies, and fake reviews are banned outright under UK consumer law (Digital Markets, Competition and Consumers Act 2024).
- **Fake urgency:** countdowns, "only a few places left", or deadlines that are not real. It is misleading under UK consumer law and against the brand's no-pressure voice.

**Enforced by:** manual. `check:a11y` colour-contrast findings catch some hidden text as a side effect.

## Sources

- Google Search Central, spam policies: https://developers.google.com/search/docs/essentials/spam-policies
- Google Search Central, title links: https://developers.google.com/search/docs/appearance/title-link
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- W3C WAI images tutorial: https://www.w3.org/WAI/tutorials/images/
