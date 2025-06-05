import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import mdx from "@astrojs/mdx";
import icon from "astro-icon";
import slug from "rehype-slug";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://withotto.app",
  trailingSlash: "always",
  integrations: [
    tailwind(),
    mdx({
      rehypePlugins: [slug],
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
