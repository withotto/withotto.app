import { getCollection } from "astro:content";
import { getBlogSlug } from "@utils/blog";

// Maps each blog route to the entry file it is built from, for the
// accessibility and SEO checks. The checks-route-sources integration in
// astro.config.mjs moves this file out of dist/ after the build, so it is
// never deployed.
export async function GET() {
  const entries = await getCollection("blog");
  const map = Object.fromEntries(
    entries
      .filter((entry) => entry.filePath)
      .map((entry) => [`/blog/${getBlogSlug(entry)}/`, entry.filePath]),
  );
  return new Response(JSON.stringify(map));
}
