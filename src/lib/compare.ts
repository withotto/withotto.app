// The shared comparison model for the Otto Capture comparison pages
// (`/capture/vs-<competitor>/`): the rows every comparison table shows, with
// Capture's side of each, the pricing scenarios both tools are priced at, and
// the helpers that join a competitor's data file to them.
//
// A competitor's facts live in `src/content/competitors/<slug>.yaml`, whose
// schema in `src/content.config.ts` accepts only the row and scenario keys
// defined here. Capture's scenario totals come from `clientCost()` in
// `@lib/capture-estimate`, called by the scenarios component, never from here.
//
// Pure functions over plain data, with no runtime imports: `pnpm test:site`
// runs this file directly under Node, which can't resolve `@lib` at runtime.

export interface ComparisonRow {
  // Stable key, used as the claim's key in a competitor's data file.
  key: string;
  label: string;
  // Capture's side, written from the shared Capture product rule. Limits are
  // stated here as well as strengths.
  capture: string;
}

// A starting set for the first brief to confirm. Every competitor's table
// shows every row; a row its data file has no claim for reads "Not stated".
export const comparisonRows = [
  {
    key: "platforms",
    label: "Accounting platforms",
    capture:
      "Xero, FreeAgent, and QuickBooks Online (purchases only on QuickBooks Online)",
  },
  {
    key: "published-documents",
    label: "Documents it publishes",
    capture:
      "Bills, purchase credit notes, sales invoices, and sales credit notes to Xero and FreeAgent. Bills and supplier credits to QuickBooks Online.",
  },
  {
    key: "pricing",
    label: "How pricing works",
    capture:
      "Per client, per month. Each client is charged at whichever of three tiers is cheapest for what it published that month.",
  },
  {
    key: "inactive-clients",
    label: "A client with nothing published in a month",
    capture: "No charge",
  },
  {
    key: "line-items",
    label: "Line items",
    capture: "Extracted as standard",
  },
  {
    key: "duplicates",
    label: "Duplicate documents",
    capture:
      "Spots an identical file sent twice and sets it aside. Only published documents are charged, so a duplicate you discard costs nothing.",
  },
  {
    key: "coding",
    label: "Nominal code suggestions",
    capture:
      "Suggested from how you've coded this client's documents from the same supplier. You review each one before it is published.",
  },
  {
    key: "client-submission",
    label: "How clients send documents",
    capture:
      "By email, through a web submission page, or by WhatsApp. Clients need no account.",
  },
  {
    key: "missing-receipts",
    label: "Missing receipts",
    capture: "Live for Xero and FreeAgent clients, not yet QuickBooks Online",
  },
  {
    key: "free-trial",
    label: "Free trial",
    capture: "30 days",
  },
] as const satisfies readonly ComparisonRow[];

export type RowKey = (typeof comparisonRows)[number]["key"];
export const rowKeys = comparisonRows.map((row) => row.key) as [
  RowKey,
  ...RowKey[],
];

// A group of clients that each publish the same number of documents a month.
export interface ClientGroup {
  clients: number;
  documents: number;
}

export interface PricingScenario {
  // Stable key, used as the scenario's key in a competitor's data file.
  key: string;
  label: string;
  groups: readonly ClientGroup[];
}

// Practices priced at stated, exact volumes, the same on every comparison
// page and chosen without reference to anyone's prices. Provisional, for the
// first brief to confirm.
export const pricingScenarios = [
  {
    key: "clients-10",
    label: "10 clients",
    groups: [
      { clients: 2, documents: 0 },
      { clients: 4, documents: 10 },
      { clients: 3, documents: 30 },
      { clients: 1, documents: 70 },
    ],
  },
  {
    key: "clients-25",
    label: "25 clients",
    groups: [
      { clients: 4, documents: 0 },
      { clients: 11, documents: 10 },
      { clients: 7, documents: 30 },
      { clients: 3, documents: 70 },
    ],
  },
  {
    key: "clients-50",
    label: "50 clients",
    groups: [
      { clients: 8, documents: 0 },
      { clients: 21, documents: 10 },
      { clients: 14, documents: 30 },
      { clients: 5, documents: 70 },
      { clients: 2, documents: 150 },
    ],
  },
] as const satisfies readonly PricingScenario[];

export type ScenarioKey = (typeof pricingScenarios)[number]["key"];
export const scenarioKeys = pricingScenarios.map(
  (scenario) => scenario.key,
) as [ScenarioKey, ...ScenarioKey[]];

// "2 with nothing published, 4 publishing 10 documents a month, …".
export function mixLabel(groups: readonly ClientGroup[]): string {
  return groups
    .map((group) =>
      group.documents === 0
        ? `${group.clients} with nothing published`
        : `${group.clients} publishing ${group.documents} documents a month`,
    )
    .join(", ");
}

// The prices a competitor's data file can give for one scenario: on the
// cheapest option with no commitment, and on the cheapest that needs one (an
// annual plan, or credits bought in advance), each without and with line items.
export const priceOptions = [
  { key: "monthly", commitment: false, lineItems: false },
  { key: "monthly-with-line-items", commitment: false, lineItems: true },
  { key: "committed", commitment: true, lineItems: false },
  { key: "committed-with-line-items", commitment: true, lineItems: true },
] as const;

export type PriceOptionKey = (typeof priceOptions)[number]["key"];
export const priceOptionKeys = priceOptions.map((option) => option.key) as [
  PriceOptionKey,
  ...PriceOptionKey[],
];

// How often a document's lines need different nominal codes or tax rates,
// measured across documents published through Capture. Shown beside the
// line-items toggle, with `measured` going through CheckedOn so the claim-age
// rule asks for it to be measured again on the same cycle as competitor claims.
export const mixedLinesUsage = {
  share: "About 1 in 12",
  period: "between June and November 2026",
  measured: "2026-11-23",
};

// How many documents Otto Capture receives for every 100 it publishes,
// measured across documents it received, leaving out any still in review.
// For a competitor that charges per document received, its scenario prices
// are for this many documents per 100 published, on the basis its data file's
// `receivedBasis` names: everything that arrives, everything but identical
// copies, or everything but copies of documents already sent. `measured` goes
// through CheckedOn, so the claim-age rule asks for it to be measured again.
export const receivedUsage = {
  period: "from July to October 2026",
  measured: "2026-11-23",
  perHundredPublished: {
    all: 119,
    "without-copies": 113,
    "without-near-duplicates": 108,
  },
} as const;

export type ReceivedBasis = keyof typeof receivedUsage.perHundredPublished;
export const receivedBases = Object.keys(receivedUsage.perHundredPublished) as [
  ReceivedBasis,
  ...ReceivedBasis[],
];

// The note under the scenarios for a competitor that charges per document
// received: everything but the measured date, which the component renders.
export function receivedNote(name: string, basis: ReceivedBasis): string {
  const count = receivedUsage.perHundredPublished[basis];
  const arrived = {
    all: `about ${count} arrived for every 100 published. The extra documents were mostly copies of ones already sent, including the same file twice, or files with nothing to publish.`,
    "without-copies": `about ${count} arrived for every 100 published, once identical copies were set aside. The extra documents were mostly copies of ones already sent, or files with nothing to publish.`,
    "without-near-duplicates": `about ${count} arrived for every 100 published, once copies of documents already sent were set aside. The extra documents were mostly files with nothing to publish.`,
  }[basis];
  return `${name} charges for every document it receives, Otto Capture only for those it publishes. Across documents Otto Capture received ${receivedUsage.period}, ${arrived} So ${name}'s prices here are for ${count} documents for every 100 Otto Capture publishes.`;
}

// The value a competitor's data file gives a claim or a scenario price that
// the competitor doesn't publish. Its source is the page that says so.
export const NOT_PUBLISHED = "not published";

// What every competitor fact carries, so a reader can check it and the drift
// run can find it again.
export interface Sourced {
  sourceUrl: string;
  // What the link to the source says, e.g. "Example pricing page". Every claim
  // citing one URL gives it the same name.
  sourceName: string;
  // YYYY-MM-DD, the day the source was read.
  checked: string;
  // Text on the source page that backs the value.
  quote: string;
}

export interface CompetitorClaim extends Sourced {
  value: string;
}

export interface CompetitorScenarioPrice extends Sourced {
  // Pounds a month, excluding VAT, or NOT_PUBLISHED.
  value: number | typeof NOT_PUBLISHED;
  plan?: string;
  // How it is billed, including any commitment, e.g. "Annual plan, paid
  // monthly".
  billing?: string;
  // What was entered in the competitor's own calculator for this scenario.
  inputs?: Record<string, string | number>;
}

export type ScenarioPrices = Partial<
  Record<PriceOptionKey, CompetitorScenarioPrice>
>;

// Whether a claim or price is stated, published as unavailable, or missing.
export function claimStatus(
  claim: { value: string | number } | null | undefined,
): ClaimStatus {
  if (claim === null || claim === undefined) return "not-stated";
  return claim.value === NOT_PUBLISHED ? "not-published" : "stated";
}

export type ClaimStatus = "stated" | "not-published" | "not-stated";

export interface JoinedRow<R, C> {
  row: R;
  claim: C | null;
  status: ClaimStatus;
}

// Pairs each row with the competitor's claim for it. A row with no claim is
// "not stated", never guessed. A claim whose key matches no row is returned in
// `unknown`, so a caller can fail rather than lose it.
export function joinClaims<
  R extends { key: string },
  C extends { value: string | number },
>(
  rows: readonly R[],
  claims: Partial<Record<string, C>>,
): { joined: JoinedRow<R, C>[]; unknown: string[] } {
  const joined = rows.map((row) => {
    const claim = claims[row.key] ?? null;
    return { row, claim, status: claimStatus(claim) };
  });
  const known = new Set(rows.map((row) => row.key));
  const unknown = Object.keys(claims).filter((key) => !known.has(key));
  return { joined, unknown };
}

export interface Source {
  url: string;
  name: string;
  // The oldest checked date of the claims that cite it.
  checked: string;
}

// Every source a set of claims cites, once each, in the order first cited. A
// URL cited under two names is returned in `conflicts`, since links to one
// place must say the same thing.
export function collectSources(items: readonly Sourced[]): {
  sources: Source[];
  conflicts: string[];
} {
  const byUrl = new Map<string, Source>();
  const conflicts = new Set<string>();
  for (const item of items) {
    const source = byUrl.get(item.sourceUrl);
    if (source === undefined) {
      byUrl.set(item.sourceUrl, {
        url: item.sourceUrl,
        name: item.sourceName,
        checked: item.checked,
      });
      continue;
    }
    if (source.name !== item.sourceName) conflicts.add(item.sourceUrl);
    if (item.checked < source.checked) source.checked = item.checked;
  }
  return { sources: [...byUrl.values()], conflicts: [...conflicts] };
}

// Every claim, prose fact and scenario price in a competitor's data file, for
// `collectSources`.
export function competitorFacts(data: {
  claims: Partial<Record<string, Sourced>>;
  facts: Partial<Record<string, Sourced>>;
  scenarios: Partial<Record<string, Partial<Record<string, Sourced>>>>;
}): Sourced[] {
  return [
    ...Object.values(data.claims),
    ...Object.values(data.facts),
    ...Object.values(data.scenarios).flatMap((prices) =>
      Object.values(prices ?? {}),
    ),
  ].filter((fact): fact is Sourced => fact !== undefined);
}

// The page a competitor's data file feeds, from the file's name.
export function comparisonRoute(id: string): string {
  return `/capture/vs-${id}/`;
}

// The competitor's data file on GitHub, where a correction can be proposed.
const repoBlob = "https://github.com/withotto/withotto.app/blob/main";
export function dataFileUrl(id: string): string {
  return `${repoBlob}/src/content/competitors/${id}.yaml`;
}

// The earliest of a set of YYYY-MM-DD dates, which sort as text.
export function oldestChecked(dates: readonly string[]): string | null {
  if (dates.length === 0) return null;
  return dates.reduce((oldest, date) => (date < oldest ? date : oldest));
}

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// "2026-11-14" -> "14 November 2026". Read from the text, so the result
// never depends on the time zone of the machine building the site.
export function formatCheckedDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${months[month - 1]} ${year}`;
}
