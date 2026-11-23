// Run by `pnpm test:site`. Same-directory imports, because Node can't resolve
// the `@lib` alias (see `capture.test.ts`).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectSources,
  competitorFacts,
  mixLabel,
  formatCheckedDate,
  joinClaims,
  oldestChecked,
  type CompetitorClaim,
} from "./compare.ts";

// A fictional competitor's claims, so the test never depends on real data.
function claim(value: string, checked: string): CompetitorClaim {
  return {
    value,
    sourceUrl: "https://example.test/pricing/",
    sourceName: "Example pricing page",
    checked,
    quote: value,
  };
}

const rows = [
  { key: "platforms", label: "Accounting platforms" },
  { key: "line-items", label: "Line items" },
  { key: "free-trial", label: "Free trial" },
];

describe("joinClaims", () => {
  it("returns every row, marking one with no claim as not stated", () => {
    const { joined, unknown } = joinClaims(rows, {
      platforms: claim("Xero and QuickBooks Online", "2026-11-14"),
      "line-items": claim("not published", "2026-11-14"),
    });
    assert.deepEqual(
      joined.map((entry) => [entry.row.key, entry.status]),
      [
        ["platforms", "stated"],
        ["line-items", "not-published"],
        ["free-trial", "not-stated"],
      ],
    );
    assert.equal(joined[2].claim, null);
    assert.deepEqual(unknown, []);
  });

  it("reports a claim key that is not a row, rather than dropping it", () => {
    const { joined, unknown } = joinClaims(rows, {
      platforms: claim("Xero", "2026-11-14"),
      "mobile-app": claim("iOS and Android", "2026-11-14"),
    });
    assert.equal(joined.length, 3);
    assert.deepEqual(unknown, ["mobile-app"]);
  });
});

describe("oldestChecked", () => {
  it("finds the earliest of several checked dates", () => {
    assert.equal(
      oldestChecked(["2026-12-02", "2026-11-14", "2026-11-30"]),
      "2026-11-14",
    );
  });

  it("has no oldest date when nothing was checked", () => {
    assert.equal(oldestChecked([]), null);
  });
});

describe("formatCheckedDate", () => {
  it("writes the day, the month in full and the year", () => {
    assert.equal(formatCheckedDate("2026-11-14"), "14 November 2026");
  });

  it("drops a leading zero from the day", () => {
    assert.equal(formatCheckedDate("2026-12-02"), "2 December 2026");
  });
});

describe("collectSources", () => {
  const help = {
    sourceUrl: "https://example.test/help/",
    sourceName: "Example help centre",
    checked: "2026-11-30",
    quote: "Works with Xero.",
  };

  it("lists each source once, in first-seen order, at its oldest checked date", () => {
    const { sources, conflicts } = collectSources([
      claim("£10", "2026-11-20"),
      help,
      claim("not published", "2026-11-14"),
    ]);
    assert.deepEqual(sources, [
      {
        url: "https://example.test/pricing/",
        name: "Example pricing page",
        checked: "2026-11-14",
      },
      {
        url: "https://example.test/help/",
        name: "Example help centre",
        checked: "2026-11-30",
      },
    ]);
    assert.deepEqual(conflicts, []);
  });

  it("reports a source given two different names", () => {
    const { conflicts } = collectSources([
      claim("£10", "2026-11-20"),
      { ...claim("£20", "2026-11-20"), sourceName: "Example prices" },
    ]);
    assert.deepEqual(conflicts, ["https://example.test/pricing/"]);
  });
});

describe("competitorFacts", () => {
  it("gathers claims, prose facts and every scenario price option", () => {
    const facts = competitorFacts({
      claims: { platforms: claim("Xero", "2026-11-14") },
      facts: { "former-name": claim("Formerly Example Ltd", "2026-11-15") },
      scenarios: {
        "clients-10": {
          monthly: {
            ...claim("not published", "2026-11-16"),
            value: "not published",
          },
          committed: { ...claim("100", "2026-11-17"), value: 100 },
        },
      },
    });
    assert.deepEqual(
      facts.map((fact) => fact.checked),
      ["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17"],
    );
  });
});

describe("mixLabel", () => {
  it("describes each group of clients by what it publishes", () => {
    assert.equal(
      mixLabel([
        { clients: 2, documents: 0 },
        { clients: 1, documents: 10 },
        { clients: 3, documents: 30 },
      ]),
      "2 with nothing published, 1 publishing 10 documents a month, 3 publishing 30 documents a month",
    );
  });
});
