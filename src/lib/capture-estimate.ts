// The Otto Capture pricing calculator's arithmetic, shared by the server render
// and the live calculator in `@components/capture/PricingCalculator.astro`, so
// the page the script takes over is already the page it would draw.
//
// Pure functions over the tier data, with only a type import: `pnpm test:site`
// runs this file directly under Node, which can't resolve `@lib` at runtime.

import type { PricingTier } from "@lib/capture";

// The rows a visitor sets. Small has no control: it is everyone else.
export type ControlledRow = "none" | "medium" | "large";
export type Row = ControlledRow | "small";
export type Rows = Record<ControlledRow, number>;

// Row order on the page and in the grid.
export const rowOrder: Row[] = ["none", "small", "medium", "large"];
export const controlledRows: ControlledRow[] = ["none", "medium", "large"];

export const MAX_CLIENTS = 99_999;

// The most squares the grid draws. The phone grid is three rows of 15 and is
// padded to that size, so the pinned summary never changes height.
export const PHONE_SQUARES = 45;
export const DESKTOP_SQUARES = 100;

export const startingMix: { clients: number; rows: Rows } = {
  clients: 20,
  rows: { none: 4, medium: 2, large: 0 },
};

// Built once, as in `@lib/capture`: the calculator formats on every step.
const wholeNumber = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
});

// 1200 -> "1,200", as the calculator's fields and labels show counts.
export function formatCount(count: number): string {
  return wholeNumber.format(count);
}

export function clientsLabel(count: number): string {
  return `${formatCount(count)} ${count === 1 ? "client" : "clients"}`;
}

// How far along its track a row's slider sits, for the filled part.
export function sliderFill(value: number, clients: number): string {
  return `${(value / clients) * 100}%`;
}

// The line under the saving: in full, and the shorter form for a phone.
export function savingDetail(none: number): { full: string; short: string } {
  return {
    full: `${clientsLabel(none)} with nothing published ${none === 1 ? "costs" : "cost"} £0`,
    short: `${clientsLabel(none)} at £0`,
  };
}

// "1,200" and "1 200" -> 1200. Anything but digits (after dropping spaces and
// commas) is null, so "1e3", "-5" and "2.5" are rejected rather than coerced.
export function parseWholeNumber(raw: string): number | null {
  const digits = raw.replace(/[\s,]/g, "");
  return /^\d+$/.test(digits) ? Number(digits) : null;
}

// A client count: at least 1, and anything above the maximum is the maximum.
export function parseCount(raw: string): number | null {
  const value = parseWholeNumber(raw);
  if (value === null || value < 1) return null;
  return Math.min(value, MAX_CLIENTS);
}

// Shares `total` out in proportion to `values`, rounding so the shares add up
// to exactly `total`: each takes its whole part, then the largest remainders
// take what is left (earlier entries first on a tie).
function largestRemainder(values: number[], total: number): number[] {
  const sum = values.reduce((acc, value) => acc + value, 0);
  if (sum === 0) return values.map(() => 0);
  const quotas = values.map((value) => (value * total) / sum);
  const shares = quotas.map(Math.floor);
  let left = total - shares.reduce((acc, share) => acc + share, 0);
  const byRemainder = quotas
    .map((quota, index) => ({ index, remainder: quota - shares[index] }))
    .sort((a, b) => b.remainder - a.remainder);
  for (const { index } of byRemainder) {
    if (left === 0) break;
    shares[index] += 1;
    left -= 1;
  }
  return shares;
}

// The rows to show for a client count, from the rows the visitor last set (the
// anchor). While they fit they show as set; when the count drops below them
// they scale down to fill it exactly, so Small shows 0. The anchor itself never
// changes here, so raising the count again gives the visitor's mix back.
export function displayRows(anchor: Rows, clients: number): Rows {
  const values = controlledRows.map((row) => anchor[row]);
  const sum = values.reduce((acc, value) => acc + value, 0);
  if (sum <= clients) return { ...anchor };
  const [none, medium, large] = largestRemainder(values, clients);
  return { none, medium, large };
}

// The new anchor after a visitor sets one row: the rows on show, with that row
// held between 0 and the clients the other two leave.
export function setRow(
  shown: Rows,
  clients: number,
  row: ControlledRow,
  value: number,
): Rows {
  const others = controlledRows
    .filter((other) => other !== row)
    .reduce((acc, other) => acc + shown[other], 0);
  return {
    ...shown,
    [row]: Math.min(Math.max(0, value), Math.max(0, clients - others)),
  };
}

export interface Estimate {
  counts: Record<Row, number>;
  costs: Record<Row, number>;
  total: number;
  // What the clients with nothing published would cost on Small.
  saving: number;
}

// Small, Medium and Large, in that order, are the rows this calculator draws.
function paidTiers(tiers: PricingTier[]): Record<Exclude<Row, "none">, number> {
  if (tiers.length !== 3) {
    throw new Error(
      `The pricing calculator expects three tiers (Small, Medium, Large), not ${tiers.length}.`,
    );
  }
  const [small, medium, large] = tiers;
  return { small: small.price, medium: medium.price, large: large.price };
}

export function estimate(
  tiers: PricingTier[],
  clients: number,
  rows: Rows,
): Estimate {
  const price = paidTiers(tiers);
  const counts: Record<Row, number> = {
    none: rows.none,
    small: Math.max(0, clients - rows.none - rows.medium - rows.large),
    medium: rows.medium,
    large: rows.large,
  };
  const costs: Record<Row, number> = {
    none: 0,
    small: counts.small * price.small,
    medium: counts.medium * price.medium,
    large: counts.large * price.large,
  };
  return {
    counts,
    costs,
    total: costs.small + costs.medium + costs.large,
    saving: counts.none * price.small,
  };
}

// One square per client up to `cap` squares; above it, each square stands for
// the fewest whole clients that keep the grid within the cap.
export function gridLayout(
  clients: number,
  cap: number,
): { perSquare: number; squares: number } {
  const perSquare = clients > cap ? Math.ceil(clients / cap) : 1;
  return { perSquare, squares: Math.ceil(clients / perSquare) };
}

// Squares per row, in `rowOrder`, totalling `squares`. A row with any clients
// always gets at least one square, taken from the row with the most.
export function allocateSquares(counts: number[], squares: number): number[] {
  const shares = largestRemainder(counts, squares);
  counts.forEach((count, index) => {
    if (count > 0 && shares[index] === 0) {
      const largest = shares.indexOf(Math.max(...shares));
      if (shares[largest] > 1) {
        shares[largest] -= 1;
        shares[index] = 1;
      }
    }
  });
  return shares;
}

// The grid for a mix: the row each square shows, in order, how many clients a
// square stands for, and how many invisible squares pad a phone grid to size.
export function gridSquares(
  counts: Record<Row, number>,
  clients: number,
  cap: number,
): { perSquare: number; rows: Row[]; placeholders: number } {
  const { perSquare, squares } = gridLayout(clients, cap);
  const shares = allocateSquares(
    rowOrder.map((row) => counts[row]),
    squares,
  );
  return {
    perSquare,
    rows: rowOrder.flatMap((row, index) =>
      Array.from({ length: shares[index] }, () => row),
    ),
    placeholders: Math.max(0, PHONE_SQUARES - squares),
  };
}
