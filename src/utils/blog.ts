import type { CollectionEntry } from "astro:content";

type BlogEntry = CollectionEntry<"blog">;

export function getBlogSlug(entry: BlogEntry): string {
  if (entry.data.slug) return entry.data.slug;
  // entry.id is path-relative under Content Layer, e.g.
  // "product-updates/2025-06-05-bank-rule-activity-report".
  // Take the basename, then strip the YYYY-MM-DD- date prefix.
  const basename = entry.id.split("/").pop() ?? entry.id;
  return basename.replace(/^\d{4}-\d{2}-\d{2}-/, "");
}

export function getBlogFolder(entry: BlogEntry): string {
  // First segment of entry.id is the subfolder under the glob base
  // (e.g. "product-updates"). Falls back to "root" for files at base.
  const segments = entry.id.split("/");
  return segments.length > 1 ? segments[0] : "root";
}

export function getContentType(entry: BlogEntry): string {
  const folder = getBlogFolder(entry);
  switch (folder) {
    case "product-updates":
      return "announcement";
    case "guides":
      return "tutorial";
    case "case-studies":
      return "case-study";
    default:
      return "article";
  }
}
