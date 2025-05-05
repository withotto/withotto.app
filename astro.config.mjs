import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import icon from "astro-icon";
import slug from "rehype-slug";
import sitemap from "@astrojs/sitemap";
import toc from "rehype-toc";

// https://astro.build/config
export default defineConfig({
  site: "https://withotto.app",
  trailingSlash: "always",
  integrations: [
    tailwind(),
    mdx({
      rehypePlugins: [
        slug,
        [
          toc,
          {
            headings: ["h1", "h2", "h3"],
            cssClasses: {
              toc: "toc-list",
            },
          },
        ],
      ],
    }),
    sitemap({
      filter: (url) => !url.startsWith("https://withotto.app/notebook/"),
    }),
    icon(),
  ],
  experimental: {
    responsiveImages: true,
  },
});
