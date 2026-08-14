# Chatwoot (website live chat)

How the public site's Chatwoot integration works in code, and the checklist for configuring the Chatwoot dashboard for sales. Load when touching the chat widget, its settings, or the sales conversation setup. Chatwoot replaced Intercom on the website in August 2026, so nothing Intercom-related remains in this repo. Intercom is still live in the Otto Capture app and the Bank Rec portal, which are migrating separately, which is why Intercom still appears in the privacy policy's list of third parties.

## What the code does

The website embeds the Chatwoot widget for anonymous visitors via `src/components/ChatwootWidget.astro`, rendered once in `src/layouts/RootLayout.astro` (so it appears on every page, both `.astro` pages and `.mdx` legal pages). The code handles:

- Loading the widget for anonymous visitors. The site has no logged-in user, so it never calls `setUser` and never signs an identifier, even though the inbox enforces identity validation. See the section below before adding anything that passes an identifier.
- The self-hosted instance at `https://chat.withotto.app`, with the public website token inline. Both are hardcoded in the component, matching the other self-hosted subdomains (bookings, newsletter) rather than an env var, so the chat cannot silently disappear from production because a build variable was missed.
- A `product` custom attribute set from the page path ("Otto Capture" on `/capture/`, "Otto Bank Rec" on `/bank-reconciliation/`, "Website (general)" elsewhere), applied on the `chatwoot:ready` event, so a sales rep sees which product a visitor was looking at.
- Deferred loading: the external `sdk.js` is fetched on browser idle or first interaction, so it does not block the initial render.

Everything else, the greeting, the bots, the routing, and the appearance, is configured in the Chatwoot dashboard. The rest of this page is the checklist for that configuration.

The website is more likely to bring sales enquiries than the tech-support conversations the Bank Rec portal and the Otto Capture app handle. The settings below tune the website inbox for that difference, without changing the support experience in the other two products.

## Before you start

- **Instance:** self-hosted Chatwoot at `https://chat.withotto.app`, with one inbox each for `withotto.app`, `capture.withotto.app`, and `portal.withotto.app`. Inbox-level settings differ per product, but contacts are account-wide and shared across all three.
- **Website token:** the token in `ChatwootWidget.astro` identifies that inbox. It is public by design. Regenerating the inbox means updating the component.
- **Allowed domains:** if the inbox restricts domains, `withotto.app` has to be listed, or the widget will not load in production.

## Identity validation

"Enforce User Identity Validation" is on for all three inboxes (Inboxes, Settings, Configuration).

The website signs nothing, because it has no accounts and never calls `setUser`. It is enforced there anyway so that the public website token, which ships in the HTML of every page, cannot be used to call `setUser` with someone else's identifier and bind to an account-wide contact created by Capture or the portal. Verified live on 14 August 2026: an unsigned `setUser` against the website inbox returns `401 HMAC failed: Invalid Identifier Hash Provided`, while the anonymous widget and the `product` attribute are unaffected.

What stays exempt (Chatwoot 4.16.2, `Api::V1::Widget::ContactsController`): contact updates carrying no `identifier`. That covers the `product` custom attribute and the pre-chat form's name and email. Only requests that supply an `identifier` are checked.

Do not add anything to the website that passes an identifier. There is no server-side session here to vouch for one, so a signing endpoint would sign whatever it was asked to sign, which is the impersonation the setting exists to prevent.

For the Capture app and the portal, where identity validation does real work:

- Compute the HMAC server-side in Django, in the view or context processor that already renders the page for the logged-in user. The inbox HMAC token stays in settings and must never reach the browser.
- Use a stable internal user ID as the `identifier`, not the email address, and pass the email in the `email` field alongside it. Changing the identifier later re-binds every contact, so settle this before the first app inbox goes live.
- The HMAC token is per inbox, so each app signs with its own.

## Greeting and prompts

Set the website inbox's welcome heading and tagline to a sales framing, so it differs from the support framing in the portal and app inboxes.

- Lead with the question a prospect actually has, for example "Looking at Otto for your practice? Ask us anything about Capture or Bank Rec."
- Keep the tone measured and no-pressure, in line with the rest of the site.
- Avoid support phrasing such as "How can we help you today?", which reads as a ticket queue rather than a sales conversation.

## Qualification and routing

- Use the pre-chat form to ask for an email address and which product the visitor is interested in, then hand off to a person. Keep it to two fields; a long form loses the enquiry.
- The widget sends a `product` contact attribute set from the page. Use it, or the page URL, in an automation rule to assign website conversations to a sales agent or team, separate from the support queue that the portal and the app feed.
- Define a custom attribute named `product` (contact attribute, text) in Chatwoot settings so the value shows on the contact in the inbox. Without it the attribute is still sent, it just is not displayed.

## Appearance

- Set the widget colour to the brand primary `#02ac8a` and add the With Otto logo as the inbox avatar.
- The widget is a standard bubble on the right. The site is light-only, so leave dark mode off rather than on "auto".

## Availability and expectations

- Set business hours and the expected reply time so visitors know when to expect an answer.
- Configure the out-of-office message and email collection for out-of-hours enquiries, consistent with the support promise to reply within a working day.

## Optional proactive message

- Consider a low-key live-chat campaign on the pricing or product pages, for example offering to answer questions about the Capture pricing tiers.
- Keep it optional and easy to dismiss. No countdowns, no fake scarcity, no pressure tactics.
