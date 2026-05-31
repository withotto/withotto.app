---
paths:
  - "src/pages/**"
  - "src/components/**"
  - "src/layouts/**"
  - "src/content/blog/**"
---

# Products: naming, status, and positioning

The non-voice decisions about how to describe Otto Capture, Otto Bank Rec, and With Otto as a brand. Load when writing any page or post that names a product.

## Brand and product names

- **With Otto** is the company and the brand. Use on legal pages, footer copy, and when referring to the organisation. Not "WithOtto", not "withotto.app" in prose (that's the domain), not "Otto" by itself (that's the persona).
- **Otto Capture** is the receipt and document capture product. "Capture" is acceptable shorthand after first mention on a page.
- **Otto Bank Rec** is the original product. Use this on new pages and in any prose where the product is the subject. "Bank Rec" alone is fine after first mention. The legacy framings "Bank Reconciliation Bot", "the Bank Reconciliation bot", and "the bot" still appear in older copy and in the support docs; leave them in place where they are, but don't introduce them in new writing. Future products won't be bots, and Otto-the-persona is a bookkeeper, not a robot.
- **Otto** is the persona, not a product name. Don't use "Otto" alone to mean a product.

Future products follow the "Otto [Verb-ish]" pattern, with planned names for month-end checks and data error discovery. Candidate names should avoid collisions with Apron Capture, Dext Precision, Xenon Connect, and other established competitor names.

## Lifecycle status

Copy should reflect the real status, not an aspirational version.

### Otto Capture

Status: beta. Public announcement has happened, the beta programme is open, Xero certification is in progress, general availability has not yet been announced.

Use:

- "Otto Capture is in beta"
- "Currently available to practices in our beta programme"
- "General availability planned once Xero certification completes"

Avoid:

- "Alpha" or "early access" (the product has progressed past these stages)
- Claims that imply GA has happened
- Specific GA dates unless they're firm

Status badges on the product page should match prose. Pick one of "Beta" or "In beta" and apply consistently across hero, badges, and copy.

### Otto Bank Rec

Status: available and supported. Trials are open and the product page can take new sign-ups. It is not actively promoted, so copy should be informative and matter-of-fact rather than a marketing push.

Position it by need, not by quality. Many teams are well served by Xero's built-in JAX, and that is fine. Otto Bank Rec is for practices and finance teams whose reconciliation needs go beyond automated rules: intelligent matching that draws on the team's own reconciliation history, and visibility into why Otto reached each decision, with corrections feeding back in so he improves over time.

Use:

- "Bank reconciliation that learns how you work"
- "Start a trial" as the primary CTA
- "Plenty of teams get what they need from JAX. Otto is for the cases where you need more."
- For existing customers: "Sign in to the portal"

Avoid:

- Any suggestion that Bank Rec is winding down, legacy, or a lower priority
- Positioning Bank Rec relative to any other Otto product; the page should stand on its own
- Hard-sell or urgency

The product page explains what Otto Bank Rec does and lets a visitor start a trial directly.

## Audience positioning

Otto Capture is for accounting and bookkeeping practices of any size. Do not position Capture as "for small practices". The differentiators (per-document pricing, line items by default, no minimums) are valuable across practice sizes.

A secondary audience is direct business users doing their own bookkeeping. If Capture pages mention this audience, do so without making them the primary focus.

## Differentiators

### Otto Capture

- **Per-document pricing with no minimums.** Most alternatives charge per-client minimums, per-practice minimums, or tiered fees that assume a minimum volume. Capture charges only for documents actually processed.
- **Line items extracted by default.** Most alternatives either don't extract line items or charge extra for it. Capture does it as standard.
- **No-training agreement with the underlying LLM provider.** Documents are not used to train the extraction model. Matters for client confidentiality and often matters to clients who ask.
- **Transparency about how it works.** Open about the AI provider, the hosting, the data lifecycle. Both a product choice and a marketing position.

### Otto Bank Rec

- **Practice-level training.** Otto learned from the practice's own reconciliation history, not a generic model.
- **Multiple reconciliation types with different credit costs.** Bank rule matches, SmartMatch, GuidedMatch, each priced by how much ML work it involved.
- **Credits carry over.** Unused credits roll to the next month without expiry.

These differentiators matter for both new trials and existing-customer communication. Lead with the first two: matching that learns from the team's own history, and decisions you can see and correct.

## Terminology

Within the Otto Capture product UI, "organisation" is the term for a customer, not "practice". This is consistent across the Capture product.

On the marketing site, "practice" is fine. You're writing to accountants and bookkeepers, and "practice" is the word they use. The exception is the Xero App Store page, where Xero's conventions apply.

"Client" always refers to the practice's client, never to the practice themselves as a customer of With Otto.

## Third-party products and integrations

- **Xero**, **FreeAgent**, **QuickBooks**: capitalise as the vendor does.
- **AWS** is acceptable after first mention of "Amazon Web Services (AWS)".
- **Supabase**: capitalise the vendor name.
- The underlying LLM provider for Otto Capture is named only on transparency pages (security and privacy), not in marketing prose. In marketing prose, refer to "a third-party LLM" if the technology needs naming at all.
- Competitors (Dext, Hubdoc, AutoEntry, Apron, Briefcase) may be named in factual comparisons. Don't name competitors in a way that reads as disparaging; let specifics speak for themselves.

## Planned and unreleased features

When pages describe things that aren't built yet:

- Be clear it's planned, not available. "FreeAgent integration is on the roadmap" beats "Works with FreeAgent".
- Don't commit to dates unless they're firm.
- A "what's coming" section is fine. Listing planned features in a capabilities list alongside shipped ones is not.
