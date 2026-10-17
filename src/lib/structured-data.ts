// JSON-LD builders for pages that pass `jsonLd` to `Layout`. Each describes
// only what a visitor can see on the page: the breadcrumb trail rendered by
// `@components/Breadcrumbs.astro`, and Otto Capture's prices from the same
// `pricingTiers` the visible pricing block renders, so neither can drift.

import { priceUnitLabels, pricingTiers } from "@lib/capture";
import type { PriceUnit } from "@lib/capture";

export interface BreadcrumbItem {
  // Visible label, e.g. "Otto Capture".
  name: string;
  // Site-relative path with a trailing slash, e.g. "/capture/".
  path: string;
}

type JsonLd = Record<string, unknown>;

function absoluteUrl(path: string, site: URL): string {
  // "//host/" and backslashes would resolve to another origin.
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("\\") ||
    !path.endsWith("/")
  ) {
    throw new Error(
      `Structured data path "${path}" must be a site path that starts and ends with "/" (trailingSlash: "always").`,
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

// One Offer per pricing tier: the tier's monthly price, in GBP, excluding VAT,
// with the unit the page's tier cards show (the cards add "excl. VAT", which
// `valueAddedTaxIncluded` carries here). No AggregateOffer, rating or
// review (the shared search rules ban ratings, and the per-document rates stay
// in the visible table only).
export function captureSoftwareApplication(
  site: URL,
  unit: PriceUnit = "client",
): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Otto Capture",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: absoluteUrl("/capture/", site),
    offers: pricingTiers.map((tier) => {
      const { price } = tier;
      return {
        "@type": "Offer",
        name: tier.name,
        price,
        priceCurrency: "GBP",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price,
          priceCurrency: "GBP",
          unitText: priceUnitLabels[unit],
          valueAddedTaxIncluded: false,
        },
      };
    }),
  };
}
