// The shared comparison model for the Otto Capture comparison pages
// (`/capture/vs-<competitor>/`): the rows every comparison table shows, with
// Capture's side of each, the pricing scenarios both tools are priced at, and
// the helpers that join a competitor's data file to them.
//
// A competitor's facts live in `src/content/competitors/<slug>.yaml`, whose
// schema in `src/content.config.ts` accepts only the row and scenario keys
// defined here. Capture's scenario totals come from `estimate()` in
// `@lib/capture-estimate`, called by the scenarios component, never from here.
//
// Pure functions over plain data, with only type imports: `pnpm test:site`
// runs this file directly under Node, which can't resolve `@lib` at runtime.

import type { Rows } from "@lib/capture-estimate";

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
      "Xero, FreeAgent and QuickBooks Online (purchases only on QuickBooks Online)",
  },
  {
    key: "published-documents",
    label: "Documents it publishes",
    capture:
      "Bills, purchase credit notes, sales invoices and sales credit notes to Xero and FreeAgent. Bills and supplier credits to QuickBooks Online.",
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
    key: "coding",
    label: "Nominal code suggestions",
    capture:
      "Suggested from how you've coded this client's documents from the same supplier. You review each one before it is published.",
  },
  {
    key: "client-submission",
    label: "How clients send documents",
    capture:
      "By email, through a web submission page or by WhatsApp. Clients need no account.",
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

export interface PricingScenario {
  // Stable key, used as the scenario's key in a competitor's data file.
  key: string;
  label: string;
  clients: number;
  // How many clients publish nothing, and how many sit on Medium and Large, as
  // the pricing calculator takes them. The rest are on Small.
  rows: Rows;
}

// Starting points for the first brief to confirm: 10, 25 and 50 clients, each
// spread across the three tiers with some publishing nothing that month.
export const pricingScenarios = [
  {
    key: "clients-10",
    label: "10 clients",
    clients: 10,
    rows: { none: 2, medium: 2, large: 1 },
  },
  {
    key: "clients-25",
    label: "25 clients",
    clients: 25,
    rows: { none: 5, medium: 5, large: 2 },
  },
  {
    key: "clients-50",
    label: "50 clients",
    clients: 50,
    rows: { none: 10, medium: 10, large: 5 },
  },
] as const satisfies readonly PricingScenario[];

export type ScenarioKey = (typeof pricingScenarios)[number]["key"];
export const scenarioKeys = pricingScenarios.map(
  (scenario) => scenario.key,
) as [ScenarioKey, ...ScenarioKey[]];

// The value a competitor's data file gives a claim or a scenario price that
// the competitor doesn't publish. Its source is the page that says so.
export const NOT_PUBLISHED = "not published";

// What every competitor fact carries, so a reader can check it and the drift
// run can find it again.
export interface Sourced {
  sourceUrl: string;
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
  billing?: string;
  // What was entered in the competitor's own calculator for this scenario.
  inputs?: Record<string, string | number>;
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
    const status: ClaimStatus =
      claim === null
        ? "not-stated"
        : claim.value === NOT_PUBLISHED
          ? "not-published"
          : "stated";
    return { row, claim, status };
  });
  const known = new Set(rows.map((row) => row.key));
  const unknown = Object.keys(claims).filter((key) => !known.has(key));
  return { joined, unknown };
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
