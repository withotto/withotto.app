---
paths:
  - "src/pages/**"
  - "src/components/**"
  - "src/layouts/**"
---

# Voice and writing: marketing pages

Landing pages, product pages, the pricing page, the FAQ page, and any other page whose primary purpose is to introduce With Otto or move a reader toward signing up or getting in touch. For blog posts, load `withotto-app-voice-blog.md` instead.

## Otto as subject

Otto does the work in marketing prose: "Otto reads each receipt", "Otto reconciles transactions", "Otto suggests account codes". Otto Capture and Otto Bank Rec are the products; Otto is the persona who does things inside them.

For Otto Capture specifically: avoid "our AI", "the AI", "Otto's AI" in running prose. Don't split the persona. Otto reads, extracts, classifies, matches, and suggests. If the underlying technology genuinely needs naming, describe it as "a third-party LLM" rather than naming the provider in marketing prose. Naming the specific provider belongs on transparency pages, not landing pages.

For Otto Bank Rec specifically: the software uses machine learning and you can name that in feature labels and descriptions ("SmartMatch uses machine learning"). You can describe Otto Bank Rec as a machine-learning product when the mechanism is the point of the sentence.

## First-person Otto: a narrow exception

First-person Otto is acceptable only in clearly mascot-framed short copy where the framing is visually obvious and the reader knows they're "meeting" Otto. Examples:

- A dedicated "Meet Otto" section or component with an illustration of Otto next to the text
- A short audio clip attributed to Otto
- A hero quote explicitly attributed to Otto
- Product-page marginalia that reads as a speech bubble

Always short. Two or three sentences at most. Never first-person Otto across a paragraph, in a feature list, on pricing pages, or in the FAQ.

Default everywhere else is team voice with Otto in third person.

## Hero and landing page patterns

Hero headlines should name a specific benefit, not a vague category. "Receipt capture that learns how your practice codes" beats "AI-powered receipt capture for modern practices". Lead with the differentiator.

Subheaders do one job: explain the headline in one sentence. Not two.

If a hero needs to mention AI, prefer the outcome over the mechanism. "Receipt capture for practices" is stronger than "AI-powered receipt capture for practices". If the mechanism needs to appear, put it in the subhead as a plain fact ("Otto extracts supplier, line items, and dates using a third-party LLM with a no-training agreement"), not as a marketing claim.

Calls to action in heroes should match the product's current stage:

- **Otto Capture:** "Join the beta" or "Request beta access" until general availability. After GA the CTA becomes a self-serve trial ("Start a trial"), optionally paired with a secondary "Book a setup call" for practices that want guided onboarding. Do not show a trial CTA until GA.
- **Otto Bank Rec:** "Start a trial" is the primary CTA, anchored to the booking section on the product page. Existing customers get "Sign in to the portal". Keep the tone informative rather than hard-sell, since the product is supported but not actively promoted.

## Transparency as differentiator

The strongest marketing move available to With Otto is being more honest than competitors. Use it.

- Where a limitation exists, name it with the reassurance alongside. "Xero app certification is in progress. You can still use Capture with your existing Xero connection."
- Where a competitor is more expensive or more complicated, let the specifics speak rather than insult the competitor. "Otto extracts line items as standard, where some tools charge extra for them."
- Where something is in beta, say so plainly. Don't dress it up as "early access for innovators".

## Product page structure

The default shape:

1. **Hero:** benefit headline, one-sentence subhead, primary CTA
2. **What it does:** two or three concrete capabilities, each with one supporting detail
3. **How it works:** a three-to-five-step outline of the user journey
4. **What makes it different:** the genuine differentiators
5. **Who it's for:** practices of any size
6. **Status and availability:** honest framing of where the product is
7. **CTA:** access, contact, or sign-in as appropriate

Not rigid, but most product pages should contain most of these.

## Pricing copy

Otto Capture is priced per client per month, across three tiers, with the per-document rate for documents over a tier's allowance shown alongside. Practices do not choose a plan: each client is placed automatically on whichever tier is cheapest for the documents it published that month.

| Tier   | Per client, per month | Included published documents | Each extra document |
| ------ | --------------------- | ---------------------------- | ------------------- |
| Small  | £9                    | 50                           | 18p                 |
| Medium | £15                   | 125                          | 12p                 |
| Large  | £29                   | 350                          | 8p                  |

Prices exclude VAT.

Lead with these three positives, using these names for consistency across the site:

- **No documents, no charge.** A client with no documents in a month is not charged, where many competitors bill per client regardless. A genuine differentiator; state it plainly.
- **Always the cheapest tier.** Each client sits on whichever tier costs least for what it published that month, worked out automatically. No plan to choose up front, no moving clients between plans.
- **No price cliffs.** Reaching a tier's allowance doesn't tip a client into the next tier and a much bigger bill. Extra documents are charged at the tier's per-document rate until the next tier works out cheaper, at which point the client moves up automatically. Above Large, documents continue at the Large rate.

Other guidance:

- Frame it as simple, predictable tiered pricing. Avoid "pay as you go"; practices associate that phrase with unpredictable bills.
- The tier prices and per-document rates are public and shown on the pricing table. Explain the mechanism in plain terms and avoid the jargon word "overage". The exact document counts where one tier overtakes the next don't need to appear on the page.
- Say only documents published to the accounting platform are charged: not duplicates, not discarded documents, not documents still to be reviewed. Avoid wording like "drafts aren't charged", which can be misread against a Draft document status.

Still internal (kept out of the committed public website and support repos): the exact tier-selection breakpoints, and the reason the no-documents check is based on received rather than published documents. When the model changes, update this section together with the Capture pricing differentiators in `withotto-app-products.md` and the internal pricing notes.

For Otto Bank Rec, pricing is established and the transparency rules apply: lead with the model in plain terms, show the pricing, no hidden "contact us" pricing, and a calculator or example where the model is non-trivial.

Pricing FAQ answers should be short and direct. Lead with the direct answer. If an answer starts "Absolutely!" or "Great question!", rewrite.

## Feature lists

Feature lists are prose, not category tags. Each item should say what it does in a sentence, not name an abstract capability.

- Poor: "AI-powered extraction"
- Better: "Otto extracts supplier, date, amount, tax, and line items from each document."

- Poor: "Seamless Xero integration"
- Better: "Publishes bills directly to Xero with the document attached."

Avoid stacking feature lists three deep on a page. More than two feature lists usually means the page needs restructuring.

## FAQs

Treat the FAQ as a real sales surface, not a dumping ground. Group questions by topic. Lead answers with the direct answer, then explain. The audience is someone who's already interested and trying to disqualify the product. Answer plainly, including when the answer is "no" or "not yet".

## Patterns to avoid

- Three-column feature grids with one-word headings ("Fast." "Smart." "Secure.")
- Testimonials without names and titles
- "Trusted by thousands" without naming any of them
- Social proof numbers without context ("10,000 receipts processed!" across how long? by how many users?)
- "Get started in seconds" when the real onboarding takes minutes
- Countdown timers, fake scarcity, or pressure tactics of any kind
- Idealised or faked product mockups where a real screenshot would do. Show the actual product. For Otto Capture, the honesty of a real interface is worth more than a polished render.
