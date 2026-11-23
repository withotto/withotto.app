import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import {
  collectSources,
  competitorFacts,
  NOT_PUBLISHED,
  rowKeys,
  scenarioKeys,
} from "@lib/compare";

const blog = defineCollection({
  loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: "./src/content/blog" }),
  schema: ({ image }) =>
    z.object({
      draft: z.boolean(),
      title: z.string(),
      excerpt: z.string(),
      slug: z.string().optional(),
      image: image(),
      imageAlt: z.string(),
      imageDescription: z.string(),
      imageCredit: z.string().optional(),
      imageCreditUrl: z.url().optional(),
      publishDate: z.string().transform((str: string) => new Date(str)),
      category: z.string(),
      tags: z.array(z.string()),
      audioFile: z.string().optional(),
    }),
});

// The day a source was read. YAML reads a bare 2026-11-14 as a date, so take
// either that or the same text, and keep it as YYYY-MM-DD text throughout.
const checkedDate = z.union([
  z.date().transform((date) => date.toISOString().slice(0, 10)),
  z.iso.date(),
]);

// What every competitor fact carries: where it was read, when, and the words
// on that page that back it. See src/content/competitors/README.md.
const sourced = {
  sourceUrl: z.url(),
  sourceName: z.string().trim().min(1),
  checked: checkedDate,
  quote: z.string().trim().min(1),
};

const claim = z.strictObject({
  value: z.string().trim().min(1),
  ...sourced,
});

// A price the competitor's calculator gave for one of the scenarios in
// @lib/compare, in pounds a month excluding VAT. A price needs its plan, its
// billing basis and the inputs entered, so the page can state its basis and
// the evidence tool can enter them again.
const scenarioPrice = z
  .strictObject({
    value: z.union([z.number().nonnegative(), z.literal(NOT_PUBLISHED)]),
    plan: z.string().trim().min(1).optional(),
    billing: z.string().trim().min(1).optional(),
    inputs: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
    ...sourced,
  })
  .superRefine((price, ctx) => {
    if (price.value === NOT_PUBLISHED) return;
    for (const field of ["plan", "billing", "inputs"] as const) {
      if (price[field] === undefined) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: `${field} is required when value is a price`,
        });
      }
    }
  });

// One YAML file per competitor, rendered by /capture/vs-<file name>/. Claims
// and scenario prices accept only the keys @lib/compare defines.
const competitors = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/competitors" }),
  schema: z
    .strictObject({
      name: z.string().trim().min(1),
      // Listed by the links to comparisons once true.
      published: z.boolean(),
      claims: z.partialRecord(z.enum(rowKeys), claim),
      scenarios: z.partialRecord(z.enum(scenarioKeys), scenarioPrice),
    })
    // Links to one source must say the same thing wherever they appear.
    .superRefine((competitor, ctx) => {
      const { conflicts } = collectSources(competitorFacts(competitor));
      for (const url of conflicts) {
        ctx.addIssue({
          code: "custom",
          message: `${url} is cited under more than one sourceName; give it the same one everywhere`,
        });
      }
    }),
});

export const collections = { blog, competitors };
