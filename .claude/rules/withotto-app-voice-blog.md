---
paths:
  - "src/content/blog/**"
---

# Voice and writing: blog

Covers blog posts at `/blog/`. For marketing pages, use `withotto-app-voice-marketing.md` instead.

## Purpose of the blog

The blog is for:

- Practical pieces aimed at UK accountants and bookkeepers, usually tied to a workflow problem the products address
- Audience-aware content on practice efficiency and bookkeeping software
- Product-adjacent writing that connects real problems to features in Otto Capture or Otto Bank Rec
- Occasional explanatory pieces on how features work
- Long-tail SEO content that targets specific queries from the audience

Not for:

- Building-in-public updates (those belong on LinkedIn)
- SEO-stuffed thin content
- Press-release-style product announcements
- Anything written in Otto's voice or signed by Otto

## Author voice

Blog posts are written in team voice. The author is a real person, usually a member of the With Otto team. Bylines go to that person, not to Otto. Otto is referenced in third person, the same way any other named thing is.

The narrator uses "we" for team decisions and "I" sparingly where it adds the author's own perspective. Most sentences have no pronoun at all; they describe what the product does or how something works.

## Tone

Informative, practical, and direct. Closer to a trade journal than a marketing blog. Assume the reader knows bookkeeping and has opinions.

Short paragraphs. One idea per paragraph. Break up long sections with sentence-case H2s. Use examples and numbers where possible. Link to support docs for anything that has an authoritative home there.

## Structure

A typical post has:

- A specific, descriptive title in sentence case. "A report to track Otto's bank rule matches" is good; "Unlock Your Bank Rule Insights" is not.
- A short lead paragraph saying what the post covers and why the reader might care.
- Body sections with H2s. H3 only when a section really needs subdivision.
- A closing paragraph with either a concrete next step (link to the feature, to a support doc, to sign in) or a genuine invitation to reply.

Avoid "conclusion" or "summary" headings unless the post is long enough to warrant them.

## Slug and metadata

Slugs are date-prefixed, lowercase, and hyphen-separated: `YYYY-MM-DD-short-descriptive-slug.mdx`. Example: `2025-06-05-bank-rule-activity-report.mdx`.

Frontmatter fields:

- `title` (sentence case, as it will appear)
- `publishDate` (ISO date)
- `description` (one or two sentences, used for meta tags and previews)
- `author` (a real person's name)
- `image` (optional hero image)

Check `withotto-app-conventions.md` or an existing post for the exact frontmatter schema before publishing.

## Audio versions

Some posts include an audio version. When one is present:

- The file lives alongside the post assets.
- The post mentions the audio near the top: "You can also listen to this post."
- Audio narration matches the post's voice, which is team voice. The audio shouldn't be framed as Otto reading the post.

## Tagline

The blog tagline is:

> Software thinking from a practice that builds its own.

This replaces the previous Bank Rec-specific tagline ("Otto's guide to working smarter through machine learning and automated reconciliation"). It's intentionally non-product-specific so it can cover Otto Capture, Otto Bank Rec, and any future products. It also leans on the founding story: With Otto is built by a practice that uses its own software, which most bookkeeping-software blogs can't claim.

## What not to do

- Don't sign posts "Otto" or "The Otto team". Use real names.
- Don't frame Otto as the author ("In this post, I'm going to walk you through…"). Otto is a topic in the post, not its narrator.
- Don't open posts with "In today's fast-paced world…" or any variation.
- Don't end posts with "Let us know in the comments!" (there are no comments).
- Don't publish thinly-rewritten press releases from Xero, FreeAgent, or anyone else. If commenting on third-party news, add a specific perspective.
