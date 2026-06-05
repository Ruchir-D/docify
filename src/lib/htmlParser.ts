import type { Heading } from '@/types'

export interface ParsedDocument {
  title: string
  pageCount: number
  html: string
}

export function parseClaudeOutput(rawOutput: string): ParsedDocument {
  const trimmed = rawOutput.trim()
  const newlineIndex = trimmed.indexOf('\n')

  if (newlineIndex === -1) {
    return { title: 'Untitled Document', pageCount: 1, html: trimmed }
  }

  const firstLine = trimmed.substring(0, newlineIndex).trim()
  const rest = trimmed.substring(newlineIndex + 1).trim()

  try {
    const meta = JSON.parse(firstLine)
    return {
      title: String(meta.title || 'Untitled Document'),
      pageCount: Number(meta.page_count) || 1,
      html: rest,
    }
  } catch {
    return { title: 'Untitled Document', pageCount: 1, html: trimmed }
  }
}

export function extractHeadings(html: string): Heading[] {
  const headings: Heading[] = []
  // Match h1-h3 with id attributes in either attribute order
  const re = /<h([1-3])[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h[1-3]>/gi
  let match

  while ((match = re.exec(html)) !== null) {
    headings.push({
      level: parseInt(match[1], 10),
      id: match[2],
      text: match[3].replace(/<[^>]+>/g, '').trim(),
    })
  }

  return headings
}
