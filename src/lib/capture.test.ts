// Run by `pnpm test:site` (Node's test runner with type stripping). Node can't
// resolve the `@lib` alias, so tests import their module by a same-directory
// path, the one exception to the alias rule.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  documentRangeLabel,
  extraDocumentLabel,
  formatPounds,
  includedLabel,
  pricingTiers,
} from "./capture.ts";
import type { PricingTier } from "./capture.ts";

describe("tier labels", () => {
  it("formats each tier's price, allowance and extra-document rate", () => {
    assert.deepEqual(
      pricingTiers.map((tier) => [
        formatPounds(tier.price),
        includedLabel(tier),
        extraDocumentLabel(tier),
      ]),
      [
        ["£9", "Up to 50", "18p"],
        ["£15", "Up to 125", "12p"],
        ["£29", "Up to 350", "8p"],
      ],
    );
  });

  it("gives each tier the document range its allowance covers", () => {
    assert.deepEqual(
      pricingTiers.map((_, index) => documentRangeLabel(pricingTiers, index)),
      [
        "1 to 50 documents a month",
        "51 to 125 documents a month",
        "126 to 350 documents a month",
      ],
    );
  });

  it("moves the next range's lower bound when an allowance changes", () => {
    const tiers: PricingTier[] = pricingTiers.map((tier, index) =>
      index === 0 ? { ...tier, allowance: 60 } : tier,
    );
    assert.equal(documentRangeLabel(tiers, 0), "1 to 60 documents a month");
    assert.equal(documentRangeLabel(tiers, 1), "61 to 125 documents a month");
  });
});

describe("formatPounds", () => {
  it("shows whole pounds without pence and groups thousands", () => {
    assert.equal(formatPounds(0), "£0");
    assert.equal(formatPounds(2899971), "£2,899,971");
  });

  it("shows pence when the amount has them", () => {
    assert.equal(formatPounds(9.5), "£9.50");
  });
});
