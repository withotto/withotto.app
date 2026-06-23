# Intercom Messenger (website live chat)

How the public site's Intercom integration works in code, and the checklist for configuring the Intercom dashboard for sales. Load when touching the chat widget, the Messenger config, or the sales conversation setup.

## What the code does

The website embeds the Intercom Messenger for anonymous visitors via `src/components/IntercomWidget.astro`, rendered once in `src/layouts/RootLayout.astro` (so it appears on every page, both `.astro` pages and `.mdx` legal pages). The code handles:

- Loading the Messenger for anonymous visitors (no logged-in user, so no Identity Verification secret is needed).
- The EU data region (`api_base` is `https://api-iam.eu.intercom.io`).
- The brand colour as a hint (`#02ac8a`, the `--color-primary` token).
- A `product` attribute set from the page path ("Otto Capture" on `/capture/`, "Otto Bank Rec" on `/bank-reconciliation/`, "Website (general)" elsewhere), so a sales rep sees which product a visitor was looking at.
- Deferred loading: the external widget script is fetched on browser idle or first interaction, so it does not block the initial render.

Everything else, the greeting, the bots, the routing, and the appearance, is configured in the Intercom dashboard. The rest of this page is the checklist for that configuration.

The website is more likely to bring sales enquiries than the tech-support conversations the Bank Rec portal and the Otto Capture app handle. The settings below tune the same workspace for that difference, without changing the support experience in the other two products.

## Before you start

- **Workspace:** the website uses the same Intercom workspace as the Bank Rec portal and the Otto Capture app, so conversations land in the existing inbox. There is no second workspace to manage.
- **Region:** the workspace is on Intercom's EU data region. The code already points at `https://api-iam.eu.intercom.io`.
- **App ID:** set `PUBLIC_INTERCOM_APP_ID` to the workspace ID (the string after `apps/` in the Intercom URL). Add it to `.env.development` for local work and to the Netlify build environment variables for production. The widget renders nothing until this is set, so the site is safe to ship before the value is in place.

## Greeting and prompts

The existing integrations greet people with a support framing. Give the website its own sales-oriented greeting, targeted by URL (`withotto.app`) or by audience so it does not change the greeting in the portal or the app.

- Lead with the question a prospect actually has, for example "Looking at Otto for your practice? Ask us anything about Capture or Bank Rec."
- Keep the tone measured and no-pressure, in line with the rest of the site.
- Avoid support phrasing such as "How can we help you today?", which reads as a ticket queue rather than a sales conversation.

## Qualification and routing

- Add a short bot or Fin flow that asks which product the visitor is interested in (Otto Capture or Otto Bank Rec) and the rough size of their practice, then hands off to a person.
- The widget sends a `product` attribute set from the page ("Otto Capture", "Otto Bank Rec", or "Website (general)"). Use it, or the page URL, to route website conversations to a sales assignee or inbox, separate from the support queue that the portal and the app feed.
- Define a custom data attribute named `product` in Intercom settings so the value shows on the lead in the inbox. It still works if undefined, it just will not be displayed.

## Appearance

- Set the Messenger action colour to the brand primary `#02ac8a` and add the With Otto logo. The dashboard appearance is what actually controls the launcher colour, so set it here even though the code also passes the colour as a hint.
- Confirm the Messenger is using the EU data region.

## Availability and expectations

- Set office hours and an expected reply time so visitors know when to expect an answer.
- Configure an email fallback for out-of-hours messages, consistent with the support promise to reply within a working day.

## Optional proactive message

- Consider a low-key outbound message on the pricing or product pages, for example offering to answer questions about the Capture pricing tiers.
- Keep it optional and easy to dismiss. No countdowns, no fake scarcity, no pressure tactics.
