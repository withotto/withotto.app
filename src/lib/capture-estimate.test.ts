// Run by `pnpm test:site`. Same-directory imports, because Node can't resolve
// the `@lib` alias (see `capture.test.ts`).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pricingTiers } from "./capture.ts";
import {
  allocateSquares,
  clientsLabel,
  DESKTOP_SQUARES,
  displayRows,
  estimate,
  formatCount,
  gridLayout,
  gridSquares,
  MAX_CLIENTS,
  parseCount,
  parseWholeNumber,
  PHONE_SQUARES,
  savingDetail,
  setRow,
  sliderFill,
  startingMix,
} from "./capture-estimate.ts";

describe("estimate", () => {
  it("prices the starting mix at about £156, with £36 saved", () => {
    const result = estimate(
      pricingTiers,
      startingMix.clients,
      startingMix.rows,
    );
    assert.deepEqual(result.counts, {
      none: 4,
      small: 14,
      medium: 2,
      large: 0,
    });
    assert.deepEqual(result.costs, {
      none: 0,
      small: 126,
      medium: 30,
      large: 0,
    });
    assert.equal(result.total, 156);
    assert.equal(result.saving, 36);
  });

  it("costs nothing, and saves Small's price for each, when nothing is published", () => {
    const result = estimate(pricingTiers, 20, {
      none: 20,
      medium: 0,
      large: 0,
    });
    assert.equal(result.total, 0);
    assert.equal(result.saving, 180);
  });

  it("has no saving when every client publishes", () => {
    const result = estimate(pricingTiers, 20, { none: 0, medium: 2, large: 0 });
    assert.equal(result.saving, 0);
  });

  it("handles the largest book without losing precision", () => {
    const result = estimate(pricingTiers, MAX_CLIENTS, {
      none: 0,
      medium: 0,
      large: MAX_CLIENTS,
    });
    assert.equal(result.total, 2899971);
  });

  it("refuses tier data it wasn't built for", () => {
    assert.throws(() =>
      estimate(pricingTiers.slice(0, 2), 20, startingMix.rows),
    );
  });
});

describe("setRow", () => {
  it("stops a row at the clients the other rows leave", () => {
    const anchor = setRow({ none: 4, medium: 2, large: 0 }, 20, "large", 20);
    assert.deepEqual(anchor, { none: 4, medium: 2, large: 14 });
    assert.equal(estimate(pricingTiers, 20, anchor).counts.small, 0);
  });

  it("never sets a row below zero", () => {
    assert.equal(
      setRow({ none: 4, medium: 2, large: 0 }, 20, "none", -3).none,
      0,
    );
  });

  it("builds the new anchor from the rows on show, plus the new value", () => {
    const shown = displayRows({ none: 4, medium: 2, large: 4 }, 5);
    assert.deepEqual(setRow(shown, 5, "medium", 0), {
      ...shown,
      medium: 0,
    });
  });
});

describe("displayRows", () => {
  it("shows the rows as set while they fit", () => {
    assert.deepEqual(displayRows({ none: 4, medium: 2, large: 4 }, 20), {
      none: 4,
      medium: 2,
      large: 4,
    });
  });

  it("scales the rows down to fit exactly, leaving Small at 0", () => {
    const rows = displayRows({ none: 4, medium: 2, large: 4 }, 5);
    assert.deepEqual(rows, { none: 2, medium: 1, large: 2 });
    assert.equal(estimate(pricingTiers, 5, rows).counts.small, 0);
  });

  it("never lets rounding hand clients back to Small", () => {
    const rows = displayRows({ none: 10, medium: 5, large: 5 }, 3);
    assert.equal(rows.none + rows.medium + rows.large, 3);
  });

  it("breaks a rounding tie in row order", () => {
    assert.deepEqual(displayRows({ none: 1, medium: 1, large: 1 }, 2), {
      none: 1,
      medium: 1,
      large: 0,
    });
  });

  it("gives the visitor's mix back when the count rises again", () => {
    const anchor = { none: 4, medium: 2, large: 4 };
    const squeezed = displayRows(anchor, 1);
    assert.equal(squeezed.none + squeezed.medium + squeezed.large, 1);
    assert.deepEqual(displayRows(anchor, 120), anchor);
  });
});

describe("parseWholeNumber and parseCount", () => {
  it("reads digits, ignoring spaces and thousands commas", () => {
    assert.equal(parseWholeNumber("1,200"), 1200);
    assert.equal(parseWholeNumber(" 1 200 "), 1200);
    assert.equal(parseWholeNumber("0"), 0);
  });

  it("rejects anything that isn't a whole number", () => {
    for (const raw of ["", "abc", "1e3", "-5", "2.5", ","]) {
      assert.equal(parseWholeNumber(raw), null, raw);
    }
  });

  it("needs at least one client and caps the count at 99,999", () => {
    assert.equal(parseCount("0"), null);
    assert.equal(parseCount("150000"), MAX_CLIENTS);
    assert.equal(parseCount("240"), 240);
  });
});

describe("gridLayout", () => {
  it("draws one square per client up to the cap", () => {
    assert.deepEqual(gridLayout(80, 100), { perSquare: 1, squares: 80 });
  });

  it("scales squares on a phone above 45 clients", () => {
    assert.deepEqual(gridLayout(240, 45), { perSquare: 6, squares: 40 });
  });
});

describe("allocateSquares", () => {
  it("matches the counts when each square is one client", () => {
    assert.deepEqual(allocateSquares([4, 14, 2, 0], 20), [4, 14, 2, 0]);
  });

  it("shares scaled squares out in proportion, totalling the square count", () => {
    const squares = allocateSquares([48, 120, 48, 24], 40);
    assert.equal(
      squares.reduce((sum, n) => sum + n, 0),
      40,
    );
    assert.deepEqual(squares, [8, 20, 8, 4]);
  });

  it("keeps a square for every small tier at once", () => {
    // 1,000 clients on a phone: 23 per square, so three tiers of one client
    // each round to nothing and must all take a square from Small.
    const squares = allocateSquares([1, 997, 1, 1], 44);
    assert.deepEqual(squares, [1, 41, 1, 1]);
  });

  it("always shows a tier that has clients", () => {
    const squares = allocateSquares([0, 239, 0, 1], 40);
    assert.equal(squares[3], 1);
    assert.equal(
      squares.reduce((sum, n) => sum + n, 0),
      40,
    );
  });
});

describe("gridSquares", () => {
  it("lists a square per client in row order, padded to a phone grid", () => {
    const { counts } = estimate(pricingTiers, 20, startingMix.rows);
    const grid = gridSquares(counts, 20, PHONE_SQUARES);
    assert.equal(grid.perSquare, 1);
    assert.deepEqual(grid.rows.slice(0, 5), [
      "none",
      "none",
      "none",
      "none",
      "small",
    ]);
    assert.equal(grid.rows.length, 20);
    assert.equal(grid.placeholders, 25);
  });

  it("pads to the phone grid whatever the cap, since padding only shows on a phone", () => {
    const { counts } = estimate(pricingTiers, 10, startingMix.rows);
    assert.equal(gridSquares(counts, 10, DESKTOP_SQUARES).placeholders, 35);
  });

  it("needs no padding once the grid is full", () => {
    const { counts } = estimate(pricingTiers, 240, startingMix.rows);
    const grid = gridSquares(counts, 240, PHONE_SQUARES);
    assert.equal(grid.perSquare, 6);
    assert.equal(grid.rows.length, 40);
    assert.equal(grid.placeholders, 5);
  });
});

describe("labels", () => {
  it("counts clients, singular for one", () => {
    assert.equal(clientsLabel(1), "1 client");
    assert.equal(clientsLabel(1190), "1,190 clients");
  });

  it("agrees the saving line with the number of clients", () => {
    assert.deepEqual(savingDetail(1), {
      full: "1 client with nothing published costs £0",
      short: "1 client at £0",
    });
    assert.equal(
      savingDetail(4).full,
      "4 clients with nothing published cost £0",
    );
  });
});

describe("formatCount and sliderFill", () => {
  it("groups thousands", () => {
    assert.equal(formatCount(99999), "99,999");
  });

  it("places a slider by its share of the clients", () => {
    assert.equal(sliderFill(5, 20), "25%");
    assert.equal(sliderFill(0, 20), "0%");
    assert.equal(sliderFill(0, 0), "0%");
  });
});
