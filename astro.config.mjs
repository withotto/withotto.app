import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import mdx from "@astrojs/mdx";
import icon from "astro-icon";
import sitemap from "@astrojs/sitemap";
import checksConfig from "./checks.config.mjs";
import routeSources from "./scripts/checks/lib/route-sources-integration.mjs";

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
    routeSources({ outputDir: checksConfig.outputDir }),
  ],
  image: {
    responsiveStyles: true,
    layout: "constrained",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
