import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { competitorSchema } from "@lib/compare";

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

// One YAML file per competitor, rendered by /capture/vs-<file name>/. The
// schema lives with the comparison model in @lib/compare, where test:site can
// test it.
const competitors = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/competitors" }),
  schema: competitorSchema,
});

export const collections = { blog, competitors };
