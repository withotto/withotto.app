// Utility function to generate clean blog slugs
export function getBlogSlug(entry: any): string {
  // Use custom slug from frontmatter if provided
  if (entry.data.slug) {
    return entry.data.slug;
  }
  
  // Extract filename from entry.slug (removes folder path)
  const filename = entry.slug.split('/').pop() || entry.slug;
  
  // Remove date prefix (YYYY-MM-DD-) from filename
  return filename.replace(/^\d{4}-\d{2}-\d{2}-/, '');
}

// Get the folder path from entry.id (useful for content organisation)
export function getBlogFolder(entry: any): string {
  const parts = entry.id.split('/');
  return parts.length > 1 ? parts[0] : 'root';
}

// Get content type with fallback based on folder
export function getContentType(entry: any): string {
  if (entry.data.contentType) {
    return entry.data.contentType;
  }
  
  // Infer from folder structure
  const folder = getBlogFolder(entry);
  switch (folder) {
    case 'product-updates': return 'announcement';
    case 'guides': return 'tutorial';
    case 'case-studies': return 'case-study';
    default: return 'article';
  }
}
