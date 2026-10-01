// JSON-LD builders for pages that pass `jsonLd` to `Layout`. Each describes
// only what a visitor can see on the page: the breadcrumb trail rendered by
// `@components/Breadcrumbs.astro`, and Otto Capture's prices from the same
// `pricingTiers` the visible pricing block renders, so neither can drift.

import { pricingTiers } from "@lib/capture";

export interface BreadcrumbItem {
  // Visible label, e.g. "Otto Capture".
  name: string;
  // Site-relative path with a trailing slash, e.g. "/capture/".
  path: string;
}

type JsonLd = Record<string, unknown>;

function absoluteUrl(path: string, site: URL): string {
  if (!path.startsWith("/") || !path.endsWith("/")) {
    throw new Error(
      `Structured data path "${path}" must start and end with "/" (trailingSlash: "always").`,
    );
  }
  return new URL(path, site).toString();
}

export function breadcrumbList(items: BreadcrumbItem[], site: URL): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path, site),
    })),
  };
}

// "£9" -> 9, "£9.50" -> 9.5. Fails the build on anything else, so a change of
// currency or format in `@lib/capture` can't publish a wrong price.
function poundsToNumber(price: string): number {
  const match = /^£(\d+(?:\.\d{1,2})?)$/.exec(price.trim());
  if (!match) {
    throw new Error(
      `Pricing tier price "${price}" is not a GBP amount like "£9" or "£9.50".`,
    );
  }
  return Number(match[1]);
}

// One Offer per pricing tier: the tier's monthly price for each client, in GBP,
// excluding VAT. No AggregateOffer, rating or review (the shared search rules
// ban ratings, and the per-document rates stay in the visible table only).
export function captureSoftwareApplication(site: URL): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Otto Capture",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: absoluteUrl("/capture/", site),
    offers: pricingTiers.map((tier) => {
      const price = poundsToNumber(tier.price);
      return {
        "@type": "Offer",
        name: tier.name,
        price,
        priceCurrency: "GBP",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price,
          priceCurrency: "GBP",
          unitText: "per client per month",
          valueAddedTaxIncluded: false,
        },
      };
    }),
  };
}
