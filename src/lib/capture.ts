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

export interface PricingTier {
  name: string;
  price: string;
  included: string;
  extraDocument: string;
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
  { name: "Small", price: "£9", included: "Up to 50", extraDocument: "18p" },
  { name: "Medium", price: "£15", included: "Up to 125", extraDocument: "12p" },
  { name: "Large", price: "£29", included: "Up to 350", extraDocument: "8p" },
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
