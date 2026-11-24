// Run by `pnpm test:site`. Same-directory imports, because Node can't resolve
// the `@lib` alias (see `capture.test.ts`).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pricingTiers } from "./capture.ts";
import { clientCost } from "./capture-estimate.ts";
import {
  captureTotal,
  collectSources,
  competitorSchema,
  competitorFacts,
  mixLabel,
  pricingScenarios,
  receivedNote,
  volumesLabel,
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

describe("receivedNote", () => {
  it("states the same count for each basis in both places it appears", () => {
    for (const [basis, count] of [
      ["all", 119],
      ["without-copies", 113],
      ["without-near-duplicates", 108],
    ] as const) {
      const note = receivedNote("Example", basis);
      assert.match(note, new RegExp(`about ${count} arrived for every 100`));
      assert.match(note, new RegExp(`prices here are for ${count} documents`));
      assert.ok(note.startsWith("Example charges for every document"), note);
    }
  });
});

describe("captureTotal", () => {
  it("prices each scenario from Capture's tiers, in whole pence", () => {
    const totals = pricingScenarios.map((scenario) =>
      captureTotal(scenario, (documents) =>
        clientCost(pricingTiers, documents),
      ),
    );
    assert.deepEqual(totals, [84.6, 217.8, 441]);
  });
});

describe("competitorSchema", () => {
  // A fictional competitor's data file, as YAML would load it.
  const source = {
    sourceUrl: "https://example.test/pricing/",
    sourceName: "Example pricing page",
    checked: new Date("2026-11-14T00:00:00Z"),
  };
  const tenClients = pricingScenarios[0];
  const valid = () => ({
    name: "Example",
    published: false,
    claims: {
      pricing: {
        value: "Per document received",
        quote: "Pay per document",
        ...source,
      },
      duplicates: {
        value: "Duplicates are charged",
        quote: "Every upload counts",
        ...source,
      },
    },
    facts: {
      "former-name": {
        value: "Formerly Sample Ltd",
        quote: "Formerly Sample",
        ...source,
      },
    },
    receivedBasis: "all",
    scenarios: {
      "clients-10": {
        monthly: {
          value: 120,
          plan: "Practice",
          billing: "Monthly",
          inputs: { documents: 140 },
          volumes: volumesLabel(tenClients.groups),
          receivedPerHundred: 119,
          quote: "£120 a month",
          ...source,
        },
        committed: { value: "not published", quote: "Contact us", ...source },
      },
    },
  });
  const issues = (data: unknown) => {
    const result = competitorSchema.safeParse(data);
    return result.success
      ? []
      : result.error.issues.map((issue) => issue.message);
  };

  it("accepts a complete file, and reads a YAML date as YYYY-MM-DD text", () => {
    const result = competitorSchema.safeParse(valid());
    assert.ok(result.success, JSON.stringify(result.error?.issues));
    assert.equal(result.data.claims.pricing?.checked, "2026-11-14");
  });

  it("rejects a source URL that isn't https", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,x",
      "http://example.test/",
    ]) {
      const data = valid();
      data.claims.pricing.sourceUrl = url;
      assert.notDeepEqual(issues(data), [], url);
    }
  });

  it("rejects a price without its plan", () => {
    const data = valid();
    delete (data.scenarios["clients-10"].monthly as { plan?: string }).plan;
    assert.ok(issues(data).some((m) => m.includes("plan is required")));
  });

  it("rejects a fact under a key that is already a claim", () => {
    const data = valid();
    (data.facts as Record<string, unknown>).pricing = data.facts["former-name"];
    assert.ok(issues(data).some((m) => m.includes("already a claim")));
  });

  it("rejects one source URL under two names", () => {
    const data = valid();
    data.claims.duplicates.sourceName = "Example prices";
    assert.ok(issues(data).some((m) => m.includes("more than one sourceName")));
  });

  it("rejects receivedBasis without the duplicates and pricing claims it rests on", () => {
    for (const key of ["duplicates", "pricing"] as const) {
      const data = valid();
      delete (data.claims as Record<string, unknown>)[key];
      assert.ok(
        issues(data).some((m) => m.includes(`${key} claim`)),
        key,
      );
    }
  });

  it("rejects a price read for different volumes than the scenario's", () => {
    const data = valid();
    data.scenarios["clients-10"].monthly.volumes = "2x0, 4x10, 3x30, 1x70";
    assert.ok(issues(data).some((m) => m.includes("read it again")));
  });

  it("rejects a price read for a different received ratio, or with none needed", () => {
    const changed = valid();
    changed.scenarios["clients-10"].monthly.receivedPerHundred = 113;
    assert.ok(issues(changed).some((m) => m.includes("read it again")));

    const notNeeded = valid() as Record<string, unknown>;
    delete notNeeded.receivedBasis;
    assert.ok(issues(notNeeded).some((m) => m.includes("receivedPerHundred")));
  });
});
