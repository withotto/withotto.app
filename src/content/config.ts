// 1. Import utilities from `astro:content`
import { defineCollection, z } from "astro:content";

// 2. Define your collection(s)
const blogCollection = defineCollection({
  schema: ({ image }) =>
    z.object({
      draft: z.boolean(),
      title: z.string(),
      excerpt: z.string(),
      image: image(),
      imageAlt: z.string(),
      imageDescription: z.string(),
      imageCredit: z.string().optional(),
      imageCreditUrl: z.string().url().optional(),
      publishDate: z.string().transform((str: string) => new Date(str)),
      category: z.string(),
      tags: z.array(z.string()),
    }),
});

// 3. Export a single `collections` object to register your collection(s)
//    This key should match your collection directory name in "src/content"
export const collections = {
  blog: blogCollection,
};
