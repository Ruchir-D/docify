export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50)
    .replace(/-$/, '')
}

export function generateUniqueSlug(title: string): string {
  const base = slugify(title) || 'document'
  const suffix = Math.random().toString(36).substring(2, 8)
  return `${base}-${suffix}`
}
