// Otto Capture pricing: the one source for /capture/ and the platform pages,
// rendered by `@components/capture/CapturePricing.astro`.

// The trial button the page kit's hero and closing call to action default to.
export const trialUrl = "https://capture.withotto.app/register/";
export const trialLabel = "Start your free trial";

// What a tier's price is for. A practice pays it for each client; a business
// doing its own books pays the same price, so its page says "per month".
export type PriceUnit = "client" | "business";

export const priceUnitLabels: Record<PriceUnit, string> = {
  client: "per client, per month",
  business: "per month",
};

// Numbers, so the tier cards, the pricing calculator and the structured data
// all format from one source. The labels below turn them into display text.
export interface PricingTier {
  name: string;
  // Price per client per month, in pounds, excluding VAT.
  price: number;
  // Published documents a month that the price includes.
  allowance: number;
  // Each published document over the allowance, in pence.
  extraDocumentPence: number;
}

// Built once: a formatter is costly to create, and the pricing calculator
// formats on every slider step.
const wholeNumber = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 0,
});
const poundsAndPence = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// 9 -> "£9", 9.5 -> "£9.50", 2899971 -> "£2,899,971".
export function formatPounds(amount: number): string {
  const format = Number.isInteger(amount) ? wholeNumber : poundsAndPence;
  return `£${format.format(amount)}`;
}

export function includedLabel(tier: PricingTier): string {
  return `Up to ${wholeNumber.format(tier.allowance)}`;
}

export function extraDocumentLabel(tier: PricingTier): string {
  return `${tier.extraDocumentPence}p`;
}

// The range of published documents a tier's allowance covers, from just above
// the previous tier's allowance: "51 to 125 documents a month". These are the
// allowances, not the volumes at which each tier becomes the cheapest.
export function documentRangeLabel(
  tiers: PricingTier[],
  index: number,
): string {
  const from = index === 0 ? 1 : tiers[index - 1].allowance + 1;
  const to = tiers[index].allowance;
  return `${wholeNumber.format(from)} to ${wholeNumber.format(to)} documents a month`;
}

export type PricingPromiseKey = "no-documents" | "cheapest-tier" | "no-cliffs";

export interface PricingPromise {
  // Stable identifier, so a page can pick promises without matching on copy.
  key: PricingPromiseKey;
  label: string;
  intent: string;
  icon: string;
}

export const pricingTiers: PricingTier[] = [
  { name: "Small", price: 9, allowance: 50, extraDocumentPence: 18 },
  { name: "Medium", price: 15, allowance: 125, extraDocumentPence: 12 },
  { name: "Large", price: 29, allowance: 350, extraDocumentPence: 8 },
];

export const pricingPromises: PricingPromise[] = [
  {
    key: "no-documents",
    label: "No documents, no charge.",
    intent:
      "If a client has nothing published in a month, you pay nothing for that client. You are only billed for the clients Otto is actively publishing for.",
    icon: "hugeicons:invoice-01",
  },
  {
    key: "cheapest-tier",
    label: "Always the cheapest tier.",
    intent:
      "Each client sits on whichever tier costs least for what it published that month, worked out for you automatically. There is no plan to pick up front, and no need to move clients between plans to chase the best price.",
    icon: "hugeicons:discount-tag-01",
  },
  {
    key: "no-cliffs",
    label: "No price cliffs.",
    intent:
      "Reaching a tier's allowance doesn't tip you straight into the next tier and a much bigger bill. You simply pay the per-document rate for each extra document published, until the next tier works out cheaper, at which point Otto moves that client up for you. Clients busier than the Large tier carry on at the Large per-document rate, so even your highest-volume clients stay predictable.",
    icon: "hugeicons:chart-up",
  },
];
