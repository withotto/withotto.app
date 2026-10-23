// JSON-LD builders for pages that pass `jsonLd` to `Layout`. Each describes
// only what a visitor can see on the page: the breadcrumb trail rendered by
// `@components/Breadcrumbs.astro`, Otto Capture's prices from the same
// `pricingTiers` the visible pricing block renders, so neither can drift, and
// a blog post from the same frontmatter its page renders.

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

export interface BlogPostingInput {
  // The post's title, shown as its H1.
  headline: string;
  // Site-relative path with a trailing slash, e.g. "/blog/some-post/".
  path: string;
  // The publish date shown under the title.
  publishDate: Date;
  // Absolute URL of the hero image, cropped as the page shows it.
  imageUrl: string;
}

// The post as its page shows it: title, date and hero image, published by
// With Otto. No author, because posts show no byline.
export function blogPosting(post: BlogPostingInput, site: URL): JsonLd {
  const url = absoluteUrl(post.path, site);
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.headline,
    url,
    mainEntityOfPage: url,
    datePublished: post.publishDate.toISOString(),
    image: post.imageUrl,
    publisher: {
      "@type": "Organization",
      name: "With Otto",
      url: absoluteUrl("/", site),
    },
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
