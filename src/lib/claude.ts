import Anthropic from '@anthropic-ai/sdk'
import { parseClaudeOutput, processHTML, hasInvalidInlineScript, type ParsedDocument } from './htmlParser'
import type { TemplateId, TemplateChoice } from '@/types'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const VALID_TEMPLATES: TemplateId[] = ['document', 'resume', 'deck', 'interactive']

const OUTPUT_FORMAT = `
Output format — follow exactly:
1. The first line of your reply must be a single-line JSON object with no surrounding markdown: {"title":"Document Title","page_count":N}
2. Immediately after that line, output the complete HTML document — starting with <!DOCTYPE html> and ending with </html>
3. Include a <title> tag in <head> that matches the document title, and a <meta name="viewport" content="width=device-width, initial-scale=1"> tag
4. No markdown code fences, no commentary, no explanations before or after — output only the JSON line followed by the raw HTML document`

const DOCUMENT_PROMPT = `Convert this PDF into a clean, professional HTML document.

Structure rules:
- Detect and pull an executive summary or abstract to the very top inside a highlighted box
- Preserve all section numbering exactly as in the original
- Convert all tables to clean HTML tables with alternating row colors
- Break paragraphs longer than 5 lines into shorter readable chunks
- Add anchor IDs to every heading (id="section-1" etc)
- Generate a sticky table of contents from all headings
- Wrap key numbers, dates, and financial figures in <span class="highlight">
- Add a document metadata bar at top: page count, estimated read time, date if found

Typography rules:
- Headings: large, clear, well spaced
- Body: 16px, 1.7 line height, max 680px width
- Tables: full width, header row darker
- Blockquotes for any quoted material

Color scheme: neutral — white background, dark gray text, teal accent (#1D9E75)

Output a single self-contained HTML file. All CSS inline in a style tag. No external dependencies.
${OUTPUT_FORMAT}`

const RESUME_PROMPT = `Convert this PDF into a modern professional profile webpage.

Structure rules:
- Extract: full name, title/role, contact info, summary/bio, experience, education, skills
- Name and title go in a large hero section at the very top
- Contact info (email, phone, LinkedIn, location) as icon + text in a horizontal bar below hero — use real <a href="mailto:..."> and <a href="tel:..."> links where applicable
- Summary or objective as a clean paragraph below contact bar
- Experience as a vertical timeline: company name, role, dates, bullet points
- Education as a clean list: institution, degree, year
- Skills as styled pill/badge tags grouped by category if possible
- Any certifications or awards as a simple list with icons

Typography rules:
- Name: very large, bold, commanding
- Role/title: medium, muted color
- Section labels: small caps or uppercase, letter-spaced, muted
- Body: clean, 15px, comfortable line height

Color scheme: derive from document — if CV has a color accent use it, otherwise default to navy (#1a2744) with white background

Output a single self-contained HTML file. All CSS inline. No external dependencies.
Print-friendly: the page must look good when printed or saved as PDF from browser — include an @media print stylesheet.
${OUTPUT_FORMAT}`

const DECK_PROMPT = `Convert this PDF into a persuasive, skimmable proposal webpage.

Structure rules:
- Extract the core pitch: what is this, why it matters, key numbers, ask or CTA
- Create a strong hero section: title, one-line description, 3 key stats
- Pull ALL numbers, percentages, financial figures into large stat cards (₹4.2Cr, 47%, 2000 units)
- Convert bullet-heavy slides into clean visual sections with icons
- Preserve any timeline or roadmap as a horizontal visual timeline
- Team section if present: photo placeholders, name, role, one-line bio
- End with a clear CTA section: what you want the reader to do next
- If there's a problem/solution structure, make it visually explicit

Typography rules:
- Headlines: large, bold, punchy
- Stats: very large numbers, small label below
- Body: concise, max 3 lines per paragraph — cut ruthlessly
- CTA: prominent button-style element

Color scheme: bold — derive primary color from document, use dark background for hero section, white for content sections

Output a single self-contained HTML file. All CSS inline. No external dependencies.
Optimized for: someone skimming in 60 seconds should understand the entire pitch.
${OUTPUT_FORMAT}`

const INTERACTIVE_PROMPT = `Convert this PDF into a rich interactive webpage. This must feel like a premium product, not a converted document.

Interactivity rules — implement ALL of these using only vanilla HTML, CSS, JavaScript:
- Sticky reading progress bar at very top (thin colored line that fills as user scrolls)
- If 3 or more major sections exist: implement a tab interface to navigate between them, with role="tablist", role="tab", aria-selected and role="tabpanel" wired up correctly
- All secondary detail sections: wrap in <details><summary> accordion — collapsed by default
- All numbers and metrics: wrap in <span class="counter" data-target="4200000"> for animated counting on scroll — data-target must be a plain number (no ₹, $, commas, or %; put the symbol/unit in surrounding text)
- Floating dark/light mode toggle button — bottom right corner, and make sure toggling it switches EVERY colored element on the page, not just the background
- Smooth scroll for all internal links
- Sticky section indicator — shows which section user is currently reading
- Tooltip definitions: identify technical terms and wrap in <span class="tooltip" data-tip="plain English definition">term</span>
- If document has steps or process: convert to an interactive stepper component
- Copy button on any data, code, or key quote blocks

Animation rules — CSS only, no libraries:
- Page load: content fades and slides up with staggered delays (animation-delay: 0.1s increments)
- Counter animation: numbers count up from 0 when they enter viewport (use IntersectionObserver with a threshold around 0.3-0.5 so it fires once the element is meaningfully on screen)
- Tab switching: smooth opacity + translate transition
- Accordion: smooth max-height transition

Color scheme:
- Corporate/finance document: deep navy + gold accent
- Technology document: dark background + electric blue accent
- Agriculture/environment document: deep green + amber accent
- Medical/health document: clean white + medical blue
- Default: Docify teal (#1D9E75) on white

Output a single self-contained HTML file. All CSS in one style tag. All JavaScript in one script tag at bottom. Zero external dependencies. Must work offline after load. Triple-check the JavaScript is syntactically valid — it will be parsed and rejected if it contains errors.
${OUTPUT_FORMAT}`

const templatePrompts: Record<TemplateId, string> = {
  document: DOCUMENT_PROMPT,
  resume: RESUME_PROMPT,
  deck: DECK_PROMPT,
  interactive: INTERACTIVE_PROMPT,
}

function textFromMessage(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
}

/**
 * Auto-detect which template best fits a document by showing the PDF to a fast
 * model and asking for a one-word classification. Falls back to "document" for
 * any unexpected reply or error, per spec.
 */
async function detectTemplate(pdfBuffer: Buffer): Promise<TemplateId> {
  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 10,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBuffer.toString('base64'),
              },
            },
            {
              type: 'text',
              text: 'What kind of document is this? Reply with exactly one word: document, resume, deck, or interactive.',
            },
          ],
        },
      ],
    })

    const word = textFromMessage(message).trim().toLowerCase().replace(/[^a-z]/g, '')
    return (VALID_TEMPLATES as string[]).includes(word) ? (word as TemplateId) : 'document'
  } catch (err) {
    console.error('[detectTemplate]', err)
    return 'document'
  }
}

async function generateFromPdf(pdfBuffer: Buffer, systemPrompt: string): Promise<ParsedDocument> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 16384,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBuffer.toString('base64'),
            },
          },
          {
            type: 'text',
            text: 'Convert this document.',
          },
        ],
      },
    ],
  })

  return parseClaudeOutput(textFromMessage(message))
}

export interface ConversionResult {
  title: string
  pageCount: number
  html: string
  template: TemplateId
}

export async function convertPdfToHtml(
  pdfBuffer: Buffer,
  template: TemplateChoice = 'auto',
): Promise<ConversionResult> {
  const resolvedTemplate = template === 'auto' ? await detectTemplate(pdfBuffer) : template

  let activeTemplate = resolvedTemplate
  let parsed = await generateFromPdf(pdfBuffer, templatePrompts[resolvedTemplate])

  // Interactive pages carry hand-written JS — if it fails to parse, silently
  // fall back to the document template rather than shipping a broken page.
  if (activeTemplate === 'interactive' && hasInvalidInlineScript(parsed.html)) {
    activeTemplate = 'document'
    parsed = await generateFromPdf(pdfBuffer, templatePrompts.document)
  }

  const html = processHTML(parsed.html, activeTemplate, { title: parsed.title })

  return { title: parsed.title, pageCount: parsed.pageCount, html, template: activeTemplate }
}
