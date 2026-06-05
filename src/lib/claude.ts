import Anthropic from '@anthropic-ai/sdk'
import { parseClaudeOutput, type ParsedDocument } from './htmlParser'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const CONVERSION_PROMPT = `Convert this PDF document into clean, semantic HTML.

Rules:
1. Output ONLY the content — no <html>, <head>, or <body> tags
2. Use semantic HTML5: article, section, h1–h6, p, ul, ol, li, table, thead, tbody, th, td, blockquote, code, pre, figure, figcaption
3. Add an id attribute to every heading using slugified text, e.g. id="section-introduction"
4. Preserve ALL text content faithfully
5. For tables: wrap in <div class="table-wrapper"> for overflow handling
6. For code blocks: use <pre><code class="language-*">
7. First line of your response must be a JSON object (no code block): {"title":"Document Title","page_count":N}
8. Then output the HTML on subsequent lines
9. No markdown, no explanations, no comments — pure HTML only

Example:
{"title":"My Report","page_count":4}
<article>
  <h1 id="section-introduction">Introduction</h1>
  <p>Content here…</p>
</article>`

export async function convertPdfToHtml(pdfBuffer: Buffer): Promise<ParsedDocument> {
  const base64Pdf = pdfBuffer.toString('base64')

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16384,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Pdf,
            },
          },
          {
            type: 'text',
            text: CONVERSION_PROMPT,
          },
        ],
      },
    ],
  })

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('\n')

  return parseClaudeOutput(text)
}
