import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

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
      imageCreditUrl: z.string().url().optional(),
      publishDate: z.string().transform((str: string) => new Date(str)),
      category: z.string(),
      tags: z.array(z.string()),
      audioFile: z.string().optional(),
    }),
});

export const collections = { blog };
