import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import icon from "astro-icon";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://withotto.app",
  trailingSlash: "always",
  integrations: [
    mdx(),
    sitemap({
      filter: (url) => !url.startsWith("https://withotto.app/notebook/"),
    }),
    icon(),
  ],
  image: {
    responsiveStyles: true,
    layout: "constrained",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
