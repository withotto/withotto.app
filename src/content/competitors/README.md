# Competitor data for the comparison pages

Each file here holds the facts one Otto Capture comparison page states about a competitor. `dext.yaml` would feed `/capture/vs-dext/`. Everything the page says about the competitor comes from its file, and every fact is backed by the competitor's own published material.

## Correcting a fact

If something here is wrong or out of date, tell us by email at support@withotto.app, or open a pull request that changes the file. Either way, a correction needs:

- **a source:** the URL of the competitor's own published page that shows the correct fact, such as its pricing page, pricing calculator, help centre, terms, release notes or official app store listing;
- **a quote:** the words on that page that back the fact.

We check the page before changing anything here. A correction with no published source can't change the page.

## The file format

The schema is in `src/content.config.ts`, and a build fails on any file that doesn't match it.

```yaml
name: Example # the competitor's name, as the page shows it
published: false # true once the page is live, which lists it in the links to comparisons

# One claim per comparison row. The row keys and labels are in src/lib/compare.ts.
claims:
  line-items:
    value: Extracted on every plan
    sourceUrl: https://example.com/pricing/
    checked: 2026-11-14 # the day the source was read
    quote: Line items are included on every plan.

# One price per pricing scenario in src/lib/compare.ts, in pounds a month excluding VAT.
scenarios:
  clients-10:
    value: 100
    plan: Practice
    billing: Monthly, per client
    inputs: # what was entered in the competitor's calculator
      clients: 10
    sourceUrl: https://example.com/pricing/
    checked: 2026-11-14
    quote: £100 per month
```

- A row with no claim shows "Not stated" on the page. Nothing is guessed.
- Where the competitor doesn't publish something, the value is `not published`, and `sourceUrl` and `quote` point to the page that says so. A scenario that isn't published needs no `plan`, `billing` or `inputs`.
- `checked` moves on only when the source has been read again and still says what the claim says.
