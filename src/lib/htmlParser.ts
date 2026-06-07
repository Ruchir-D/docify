import * as cheerio from 'cheerio'
import type { Element, ChildNode } from 'domhandler'
import * as vm from 'node:vm'
import { slugify } from './slugify'
import type { Heading, TemplateId } from '@/types'

export interface ParsedDocument {
  title: string
  pageCount: number
  html: string
}

export interface ShareContext {
  template: TemplateId
  title: string
  pageCount: number
  viewCount: number
  shareUrl: string
}

const SYSTEM_FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"

const BRAND_TEAL = '#1D9E75'

// ─── Parsing Claude's raw output ──────────────────────────────────────────

export function parseClaudeOutput(rawOutput: string): ParsedDocument {
  let trimmed = rawOutput.trim()

  // Defensive: Claude was told not to wrap output in a code fence, but strip
  // one if it slipped through.
  const fenced = trimmed.match(/^```[a-z]*\s*\n([\s\S]*?)\n```$/i)
  if (fenced) trimmed = fenced[1].trim()

  const newlineIndex = trimmed.indexOf('\n')
  if (newlineIndex === -1) {
    return { title: 'Untitled Document', pageCount: 1, html: trimmed }
  }

  const firstLine = trimmed.slice(0, newlineIndex).trim()
  const rest = trimmed.slice(newlineIndex + 1).trim()

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

/**
 * Parses every inline (non-src) <script> block as a syntax check, without
 * executing it. Used to silently fall back to the document template when the
 * interactive template produces broken JavaScript.
 */
export function hasInvalidInlineScript(html: string): boolean {
  const $ = cheerio.load(html)
  let invalid = false

  $('script').each((_, el) => {
    const $el = $(el)
    if ($el.attr('src')) return
    const code = $el.html()
    if (!code || !code.trim()) return
    try {
      // eslint-disable-next-line no-new
      new vm.Script(code)
    } catch {
      invalid = true
    }
  })

  return invalid
}

// ─── Small shared helpers ─────────────────────────────────────────────────

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeJs(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ')
}

function estimateReadTime(text: string, wordsPerMinute: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / wordsPerMinute))
}

function isTextNode(node: ChildNode): node is ChildNode & { data: string } {
  return node.type === 'text'
}

/** Adds a slugified id to any heading missing one, and de-duplicates ids. */
function ensureHeadingIds($: cheerio.CheerioAPI): void {
  const used = new Set<string>()

  $('h1, h2, h3, h4').each((i, el) => {
    const $el = $(el)
    const existing = $el.attr('id')
    let base = existing || slugify($el.text()) || `section-${i + 1}`
    let id = base
    let n = 2
    while (used.has(id)) id = `${base}-${n++}`
    used.add(id)
    if (id !== existing) $el.attr('id', id)
  })
}

function extractHeadings($: cheerio.CheerioAPI): Heading[] {
  const headings: Heading[] = []
  $('h1, h2, h3').each((_, el) => {
    const id = $(el).attr('id')
    if (!id) return
    headings.push({ id, level: parseInt(el.tagName.slice(1), 10), text: $(el).text().trim() })
  })
  return headings
}

const WEB_FONT_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'use.typekit.net',
  'fonts.adobe.com',
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com',
]

/**
 * Removes links/imports to external font & script CDNs (so the page truly
 * works offline) and rewrites font-family declarations to the system font
 * stack. With `stripAll`, every font-family declaration is dropped instead —
 * used by the document template, which owns its own typography.
 */
function sanitizeFonts($: cheerio.CheerioAPI, opts: { stripAll: boolean }): void {
  $('link[rel="stylesheet"], link[rel="preconnect"], link[rel="preload"]').each((_, el) => {
    const href = $(el).attr('href') || ''
    if (WEB_FONT_HOSTS.some((host) => href.includes(host)) || /^https?:\/\//.test(href)) {
      $(el).remove()
    }
  })
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src') || ''
    if (/^https?:\/\//.test(src)) $(el).remove()
  })

  $('style').each((_, el) => {
    const $el = $(el)
    let css = $el.html() || ''
    css = css.replace(/@import\s+url\(['"]?[^'")]+['"]?\);?/gi, '')
    css = css.replace(/font-family\s*:[^;}]+;?/gi, (decl) =>
      opts.stripAll ? '' : `font-family: ${SYSTEM_FONT_STACK};`,
    )
    $el.html(css)
  })

  $('[style*="font-family"]').each((_, el) => {
    const $el = $(el)
    const style = $el.attr('style') || ''
    const next = style.replace(/font-family\s*:[^;]+;?/gi, (decl) =>
      opts.stripAll ? '' : `font-family: ${SYSTEM_FONT_STACK};`,
    )
    $el.attr('style', next)
  })
}

/** Drops <img> tags pointing at relative/local paths — they'd 404 once served standalone. */
function removeBrokenImages($: cheerio.CheerioAPI): void {
  $('img').each((_, el) => {
    const src = $(el).attr('src') || ''
    if (!src.startsWith('data:') && !/^https?:\/\//.test(src)) $(el).remove()
  })
}

function ensureViewportMeta($: cheerio.CheerioAPI): void {
  if ($('meta[name="viewport"]').length === 0) {
    $('head').prepend('<meta name="viewport" content="width=device-width, initial-scale=1">')
  }
}

// ─── Template 1: Document ─────────────────────────────────────────────────

const DOC_READ_WPM = 200

const TOC_STYLE = `
.docify-toc{margin:28px 0;padding:16px 18px;border:1px solid #ececec;border-radius:14px;background:#fafafa;font-size:13px;display:none}
.docify-toc p{margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#9aa;color:#9a9a9a}
.docify-toc ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:3px}
.docify-toc a{display:block;padding:5px 9px;border-radius:8px;color:#555;text-decoration:none;line-height:1.35}
.docify-toc a:hover{background:rgba(29,158,117,.08);color:${BRAND_TEAL}}
@media (min-width:1024px){
  .docify-toc{display:block;float:left;position:sticky;top:24px;width:208px;max-height:calc(100vh - 64px);overflow-y:auto;margin:6px 36px 24px 0}
}`

function buildToc(headings: Heading[]): string {
  const items = headings
    .map((h) => {
      const indent = (h.level - 1) * 12
      return `<li style="padding-left:${indent}px"><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`
    })
    .join('')
  return `<nav class="docify-toc" aria-label="Table of contents"><p>Contents</p><ul>${items}</ul></nav>`
}

function hasTocLike($: cheerio.CheerioAPI, headingIds: Set<string>): boolean {
  let found = false
  $('nav, aside').each((_, el) => {
    const links = $(el).find('a[href^="#"]')
    if (links.length < 3) return
    let matches = 0
    links.each((_, a) => {
      const href = ($(a).attr('href') || '').slice(1)
      if (headingIds.has(href)) matches++
    })
    if (matches >= 3) found = true
  })
  return found
}

function injectReadTime($: cheerio.CheerioAPI, minutes: number): void {
  const re = /\b\d+\s*min(?:ute)?s?\s*read\b/i
  $('*')
    .filter((_, el) => $(el).children().length === 0 && re.test($(el).text()))
    .first()
    .each((_, el) => {
      const $el = $(el)
      $el.text($el.text().replace(re, `${minutes} min read`))
    })
}

function processDocumentTemplate(html: string): string {
  const $ = cheerio.load(html)

  sanitizeFonts($, { stripAll: true })
  removeBrokenImages($)
  ensureHeadingIds($)
  ensureViewportMeta($)

  // Only one h1 allowed — the document title. Demote any others to h2.
  $('h1').each((i, el) => {
    if (i === 0) return
    el.tagName = 'h2'
    el.name = 'h2'
  })

  // Accessible table headers
  $('th').each((_, el) => {
    if (!$(el).attr('scope')) $(el).attr('scope', 'col')
  })

  const minutes = estimateReadTime($('body').text(), DOC_READ_WPM)
  injectReadTime($, minutes)

  const headings = extractHeadings($)
  if (headings.length >= 3 && !hasTocLike($, new Set(headings.map((h) => h.id)))) {
    $('head').append(`<style>${TOC_STYLE}</style>`)
    const $h1 = $('h1').first()
    if ($h1.length) $h1.after(buildToc(headings))
    else $('body').prepend(buildToc(headings))
  }

  return $.html()
}

// ─── Template 2: Resume ───────────────────────────────────────────────────

const SKILL_KEYWORDS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'Ruby', 'PHP',
  'Swift', 'Kotlin', 'SQL', 'HTML', 'CSS', 'R', 'Scala', 'MATLAB',
  'React', 'Angular', 'Vue', 'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'Rails',
  'Next.js', 'Tailwind', 'Figma', 'Photoshop', 'Illustrator', 'Excel', 'PowerPoint', 'Word',
  'Salesforce', 'SAP', 'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Git', 'Jira',
  'Tableau', 'Power BI', 'MongoDB', 'PostgreSQL', 'MySQL',
  'Leadership', 'Communication', 'Project Management', 'Teamwork', 'Problem Solving',
  'Negotiation', 'Public Speaking', 'Strategic Planning', 'Data Analysis',
  'Customer Service', 'Sales', 'Marketing', 'SEO', 'Content Writing', 'Copywriting',
  'Accounting', 'Budgeting', 'Recruiting', 'Research', 'Editing', 'Translation',
]

function extractSkillsFromText(text: string): string[] {
  const found: string[] = []
  for (const skill of SKILL_KEYWORDS) {
    const re = new RegExp(`\\b${skill.replace(/[.+]/g, '\\$&')}\\b`, 'i')
    if (re.test(text)) found.push(skill)
  }
  return found
}

const RESUME_STYLE = `
.docify-skills{margin:32px 0}
.docify-skills p{margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#8a93a6}
.docify-skills ul{list-style:none;display:flex;flex-wrap:wrap;gap:8px;margin:0;padding:0}
.docify-skills li{padding:6px 14px;border-radius:999px;background:rgba(26,39,68,.07);color:#1a2744;font-size:13px;font-weight:500}
.docify-print-btn{position:fixed;top:14px;right:16px;z-index:2147483000;border:0;border-radius:999px;background:#1a2744;color:#fff;font-size:12px;font-weight:600;padding:9px 16px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.18)}
.docify-print-btn:hover{opacity:.88}
@media print{.docify-print-btn,.docify-bar,.docify-footer{display:none !important}}`

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const FULL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function normalizeMonthToken(token: string): string | null {
  const lower = token.toLowerCase().replace(/\.$/, '')
  const fullIdx = FULL_MONTHS.findIndex((m) => m.toLowerCase() === lower)
  if (fullIdx >= 0) return MONTHS[fullIdx]
  const shortIdx = MONTHS.findIndex((m) => m.toLowerCase() === lower.slice(0, 3))
  return shortIdx >= 0 ? MONTHS[shortIdx] : null
}

function formatDateToken(raw: string): string {
  const trimmed = raw.trim()
  if (/^(present|current|now|ongoing)$/i.test(trimmed)) return 'Present'

  let m = trimmed.match(/^(\d{1,2})[/-](\d{4})$/)
  if (m) {
    const idx = parseInt(m[1], 10) - 1
    return idx >= 0 && idx < 12 ? `${MONTHS[idx]} ${m[2]}` : trimmed
  }

  m = trimmed.match(/^([A-Za-z]+)\.?\s+(\d{4})$/)
  if (m) {
    const month = normalizeMonthToken(m[1])
    return month ? `${month} ${m[2]}` : trimmed
  }

  return /^\d{4}$/.test(trimmed) ? trimmed : trimmed
}

const MONTH_TOKEN = '(?:[A-Za-z]+\\.?\\s+\\d{4}|\\d{1,2}[/-]\\d{4}|\\d{4})'
const DATE_RANGE_RE = new RegExp(
  `\\b(${MONTH_TOKEN})\\s*(?:[-–—]|to)\\s*(${MONTH_TOKEN}|present|current|now|ongoing)\\b`,
  'gi',
)

function normalizeDateRanges($: cheerio.CheerioAPI): void {
  $('body')
    .find('*')
    .addBack()
    .contents()
    .filter((_, n): n is ChildNode & { data: string } => isTextNode(n))
    .each((_, node) => {
      if (!DATE_RANGE_RE.test(node.data)) return
      DATE_RANGE_RE.lastIndex = 0
      node.data = node.data.replace(
        DATE_RANGE_RE,
        (_match, start: string, end: string) => `${formatDateToken(start)} — ${formatDateToken(end)}`,
      )
    })
}

function buildPersonSchema($: cheerio.CheerioAPI): string | null {
  const $h1 = $('h1').first()
  const name = $h1.text().trim()
  if (!name) return null

  let jobTitle = ''
  let sib = $h1.next()
  for (let i = 0; i < 4 && sib.length; i++) {
    const text = sib.text().trim()
    if (text && text.length < 120 && !sib.is('nav, ul, ol, table')) {
      jobTitle = text
      break
    }
    sib = sib.next()
  }

  const email = $('a[href^="mailto:"]').first().attr('href')?.replace(/^mailto:/i, '').trim()
  const phone = $('a[href^="tel:"]').first().attr('href')?.replace(/^tel:/i, '').trim()

  const schema: Record<string, unknown> = { '@context': 'https://schema.org', '@type': 'Person', name }
  if (jobTitle) schema.jobTitle = jobTitle
  if (email) schema.email = email
  if (phone) schema.telephone = phone

  return JSON.stringify(schema)
}

function processResumeTemplate(html: string): string {
  const $ = cheerio.load(html)

  sanitizeFonts($, { stripAll: false })
  removeBrokenImages($)
  ensureHeadingIds($)
  ensureViewportMeta($)
  normalizeDateRanges($)

  $('head').append(`<style>${RESUME_STYLE}</style>`)
  $('body').prepend(
    '<button class="docify-print-btn" onclick="window.print()" aria-label="Print or save as PDF">Print / Save PDF</button>',
  )

  // If no skills section exists, mine the experience text for likely skills.
  const hasSkillsHeading = $('h1, h2, h3, h4')
    .toArray()
    .some((el) => /skills?/i.test($(el).text()))
  if (!hasSkillsHeading) {
    const skills = extractSkillsFromText($('body').text())
    if (skills.length > 0) {
      const pills = skills.map((s) => `<li>${escapeHtml(s)}</li>`).join('')
      const section = `<section class="docify-skills"><p>Skills</p><ul>${pills}</ul></section>`
      const $eduHeading = $('h1, h2, h3, h4').filter((_, el) => /education/i.test($(el).text())).first()
      if ($eduHeading.length) $eduHeading.before(section)
      else $('body').append(section)
    }
  }

  const schema = buildPersonSchema($)
  if (schema) $('head').append(`<script type="application/ld+json">${schema}</script>`)

  return $.html()
}

// ─── Template 3: Deck / Proposal ──────────────────────────────────────────

const DECK_READ_WPM = 400

type CurrencySymbol = '₹' | '$' | '€' | '£'
const CURRENCY_RULES: { symbol: CurrencySymbol; pattern: RegExp }[] = [
  { symbol: '₹', pattern: /(?:\bRs\.?\s?|\bINR\s?|₹)/g },
  { symbol: '$', pattern: /(?:\bUSD\s?|\$)/g },
  { symbol: '€', pattern: /(?:\bEUR\s?|€)/g },
  { symbol: '£', pattern: /(?:\bGBP\s?|£)/g },
]

function standardizeCurrency($: cheerio.CheerioAPI): void {
  const bodyText = $('body').text()
  let dominant: CurrencySymbol | null = null
  let bestCount = 0
  for (const rule of CURRENCY_RULES) {
    const matches = bodyText.match(rule.pattern)
    const count = matches?.length ?? 0
    if (count > bestCount) {
      bestCount = count
      dominant = rule.symbol
    }
  }
  if (!dominant || bestCount < 2) return

  $('body')
    .find('*')
    .addBack()
    .contents()
    .filter((_, n): n is ChildNode & { data: string } => isTextNode(n))
    .each((_, node) => {
      let next = node.data
      for (const rule of CURRENCY_RULES) {
        if (rule.symbol === dominant) continue
        rule.pattern.lastIndex = 0
        next = next.replace(rule.pattern, dominant!)
      }
      if (next !== node.data) node.data = next
    })
}

function detectSlideCount($: cheerio.CheerioAPI, pageCount: number): number | null {
  const text = $('body').text()
  let m = text.match(/\bslide\s+\d+\s+of\s+(\d+)\b/i)
  if (m) return parseInt(m[1], 10)
  m = text.match(/\b(\d{1,3})[\s-]+slides?\b/i)
  if (m) return parseInt(m[1], 10)
  // A pitch deck PDF where each page is a slide
  return pageCount >= 3 ? pageCount : null
}

const DECK_STYLE = `
.docify-deck-badges{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
.docify-deck-badges span{display:inline-flex;align-items:center;border-radius:999px;background:rgba(255,255,255,.12);color:inherit;font-size:12px;font-weight:600;padding:6px 14px;backdrop-filter:blur(6px)}
.docify-share{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0}
.docify-share a,.docify-share button{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:9px 16px;font-size:13px;font-weight:600;color:inherit;text-decoration:none;background:rgba(255,255,255,.08);cursor:pointer;font-family:inherit}
.docify-share a:hover,.docify-share button:hover{background:rgba(255,255,255,.18)}`

function injectDeckBadges($: cheerio.CheerioAPI, badges: string[]): void {
  if (badges.length === 0) return
  const html = `<div class="docify-deck-badges">${badges.map((b) => `<span>${escapeHtml(b)}</span>`).join('')}</div>`
  const $h1 = $('h1').first()
  if ($h1.length) $h1.after(html)
  else $('body').prepend(html)
}

function processDeckTemplate(html: string, ctx: { pageCount: number }): string {
  const $ = cheerio.load(html)

  sanitizeFonts($, { stripAll: false })
  removeBrokenImages($)
  ensureHeadingIds($)
  ensureViewportMeta($)
  standardizeCurrency($)

  // Counter-style stat values should also be parseable downstream
  $('[data-target]').each((_, el) => {
    const raw = $(el).attr('data-target') || ''
    const cleaned = raw.replace(/[^0-9.\-]/g, '')
    if (cleaned && cleaned !== raw) $(el).attr('data-target', cleaned)
  })

  $('head').append(`<style>${DECK_STYLE}</style>`)

  const badges: string[] = []
  const slideCount = detectSlideCount($, ctx.pageCount)
  if (slideCount) badges.push(`${slideCount}-slide deck`)
  badges.push(`~${estimateReadTime($('body').text(), DECK_READ_WPM)} min skim`)
  injectDeckBadges($, badges)

  // Share buttons go in the hero; the share URL is filled in at serve time.
  const shareBlock = [
    '<div class="docify-share">',
    `<a href="https://wa.me/?text=__DOCIFY_SHARE_TEXT__" target="_blank" rel="noopener">Share on WhatsApp</a>`,
    `<a href="mailto:?subject=__DOCIFY_SHARE_SUBJECT__&body=__DOCIFY_SHARE_TEXT__">Share via email</a>`,
    `<button onclick="navigator.clipboard&&navigator.clipboard.writeText('__DOCIFY_SHARE_URL__');this.textContent='Copied!';setTimeout(()=>this.textContent='Copy link',1600)">Copy link</button>`,
    '</div>',
  ].join('')
  const $h1 = $('h1').first()
  if ($h1.length) $h1.after(shareBlock)
  else $('body').prepend(shareBlock)

  return $.html()
}

// ─── Template 4: Interactive ──────────────────────────────────────────────

const DARK_MODE_FALLBACK = {
  style: `
.docify-theme-toggle{position:fixed;bottom:20px;right:20px;z-index:2147483000;width:46px;height:46px;border-radius:50%;border:0;background:#1D9E75;color:#fff;font-size:18px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.22)}
html[data-docify-theme="dark"]{filter:invert(1) hue-rotate(180deg)}
html[data-docify-theme="dark"] img,html[data-docify-theme="dark"] video,html[data-docify-theme="dark"] svg,html[data-docify-theme="dark"] picture,html[data-docify-theme="dark"] .docify-bar,html[data-docify-theme="dark"] .docify-footer{filter:invert(1) hue-rotate(180deg)}`,
  script: `(function(){
  var btn=document.createElement('button');
  btn.className='docify-theme-toggle';
  btn.setAttribute('aria-label','Toggle dark mode');
  btn.textContent='\\u{1F319}';
  btn.addEventListener('click',function(){
    var isDark=document.documentElement.getAttribute('data-docify-theme')==='dark';
    document.documentElement.setAttribute('data-docify-theme', isDark?'light':'dark');
    btn.textContent=isDark?'\\u{1F319}':'\\u{2600}\\u{FE0F}';
  });
  document.body.appendChild(btn);
})();`,
}

function fixIntersectionObserverThresholds(js: string): string {
  return js.replace(
    /(\bnew\s+IntersectionObserver\s*\(\s*[^,]+,\s*\{[^}]*?threshold\s*:\s*)0(\.0+)?(\s*[,}])/g,
    '$10.4$3',
  )
}

function ensureTabAria($: cheerio.CheerioAPI): void {
  const groups = new Map<Element | null, Element[]>()
  $('[data-tab]').each((_, el) => {
    const parent = el.parent as Element | null
    const list = groups.get(parent) ?? []
    list.push(el)
    groups.set(parent, list)
  })

  for (const tabs of groups.values()) {
    let hasSelected = false
    for (const el of tabs) {
      const $el = $(el)
      if (!$el.attr('role')) $el.attr('role', 'tab')
      if ($el.attr('aria-selected') === 'true') hasSelected = true
    }
    tabs.forEach(($el, i) => {
      const $t = $($el)
      if (!$t.attr('aria-selected')) $t.attr('aria-selected', !hasSelected && i === 0 ? 'true' : 'false')
    })
  }

  $('[data-tabpanel]').each((_, el) => {
    const $el = $(el)
    if (!$el.attr('role')) $el.attr('role', 'tabpanel')
  })

  $('[data-tab]').closest('[role="tablist"], .tabs, .tab-nav, .tab-list').attr('role', 'tablist')
}

function processInteractiveTemplate(html: string): string {
  const $ = cheerio.load(html)

  sanitizeFonts($, { stripAll: false })
  removeBrokenImages($)
  ensureHeadingIds($)
  ensureViewportMeta($)
  ensureTabAria($)

  // Sanitize counter targets (strip ₹, $, commas, % so JS can parse a clean number)
  $('.counter[data-target], [data-target]').each((_, el) => {
    const raw = $(el).attr('data-target') || ''
    const cleaned = raw.replace(/[^0-9.\-]/g, '')
    if (cleaned && cleaned !== raw) $(el).attr('data-target', cleaned)
  })

  // Fix the common "threshold: 0" IntersectionObserver mistake (fires immediately
  // instead of once the element is meaningfully on screen).
  $('script').each((_, el) => {
    const $el = $(el)
    if ($el.attr('src')) return
    const code = $el.html()
    if (!code) return
    const fixed = fixIntersectionObserverThresholds(code)
    if (fixed !== code) $el.html(fixed)
  })

  // If Claude didn't ship a working dark-mode toggle, add a guaranteed fallback
  // that inverts the whole page (and double-inverts media back to normal).
  const hasToggle = /dark.?mode|theme.?toggle|data-theme|prefers-color-scheme/i.test($('body').html() || '') ||
    /dark.?mode|theme.?toggle|data-theme/i.test($('script').text())
  if (!hasToggle) {
    $('head').append(`<style>${DARK_MODE_FALLBACK.style}</style>`)
    $('body').append(`<script>${DARK_MODE_FALLBACK.script}</script>`)
  }

  return $.html()
}

// ─── Dispatcher ───────────────────────────────────────────────────────────

export function processHTML(
  html: string,
  template: TemplateId,
  ctx: { title: string; pageCount?: number } = { title: 'Untitled Document' },
): string {
  switch (template) {
    case 'document':
      return processDocumentTemplate(html)
    case 'resume':
      return processResumeTemplate(html)
    case 'deck':
      return processDeckTemplate(html, { pageCount: ctx.pageCount ?? 1 })
    case 'interactive':
      return processInteractiveTemplate(html)
  }
}

// ─── Shared elements, injected fresh on every request ─────────────────────

function buildTopBar(ctx: ShareContext): string {
  const safeTitle = escapeHtml(ctx.title)
  const safeUrl = escapeHtml(ctx.shareUrl)
  const copyHandler =
    `navigator.clipboard&&navigator.clipboard.writeText('${escapeJs(ctx.shareUrl)}');` +
    `this.textContent='Copied!';setTimeout(()=>{this.textContent='Copy link'},1600)`

  if (ctx.template === 'resume') {
    return `<div class="docify-bar" style="position:sticky;top:0;z-index:2147483000;display:flex;align-items:center;justify-content:flex-end;gap:10px;height:44px;padding:0 16px;background:#1a2744;font-family:${SYSTEM_FONT_STACK}">
      <button onclick="${copyHandler}" style="border:0;border-radius:999px;background:rgba(255,255,255,.16);color:#fff;font-size:12px;font-weight:600;padding:7px 14px;cursor:pointer">Copy link</button>
      <a href="/" style="color:#fff;font-size:12px;font-weight:600;text-decoration:none;border-radius:999px;background:rgba(255,255,255,.16);padding:7px 14px">Convert your PDF →</a>
    </div>`
  }

  return `<div class="docify-bar" style="position:sticky;top:0;z-index:2147483000;display:flex;align-items:center;gap:14px;height:48px;padding:0 18px;background:${BRAND_TEAL};font-family:${SYSTEM_FONT_STACK};color:#fff;font-size:13px">
    <a href="/" style="color:#fff;font-weight:800;letter-spacing:-.02em;text-decoration:none;font-size:15px">docify</a>
    <span style="opacity:.4">/</span>
    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;max-width:46vw">${safeTitle}</span>
    <div style="margin-left:auto;display:flex;align-items:center;gap:14px">
      <span style="opacity:.7;font-size:11px">${ctx.pageCount}p · ${ctx.viewCount.toLocaleString()} views</span>
      <button onclick="${copyHandler}" style="border:0;border-radius:999px;background:rgba(255,255,255,.16);color:#fff;font-size:12px;font-weight:600;padding:7px 14px;cursor:pointer">Copy link</button>
      <a href="/" style="color:#fff;font-size:12px;font-weight:600;text-decoration:none;border-radius:999px;background:rgba(255,255,255,.16);padding:7px 14px;white-space:nowrap">Convert your PDF →</a>
    </div>
  </div>
  <link rel="canonical" href="${safeUrl}">`
}

function buildFooter(): string {
  return `<footer class="docify-footer" style="font-family:${SYSTEM_FONT_STACK};margin-top:48px;padding:32px 16px;text-align:center;border-top:1px solid rgba(0,0,0,.06)">
    <a href="/" style="display:inline-flex;align-items:center;gap:10px;border:1px solid rgba(0,0,0,.08);border-radius:16px;padding:12px 18px;text-decoration:none;color:inherit;background:rgba(0,0,0,.02)">
      <span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:${BRAND_TEAL};color:#fff;font-weight:800;font-size:13px">d</span>
      <span style="text-align:left">
        <span style="display:block;font-size:12px;font-weight:700">Made with Docify</span>
        <span style="display:block;font-size:11px;opacity:.55">Convert your own PDF →</span>
      </span>
    </a>
  </footer>`
}

function buildOgTags(ctx: ShareContext): string {
  const safeTitle = escapeHtml(ctx.title)
  const description = escapeHtml(`Read "${ctx.title}" — converted from PDF by Docify`)
  return [
    `<meta property="og:title" content="${safeTitle}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:url" content="${escapeHtml(ctx.shareUrl)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${safeTitle}">`,
    `<meta name="twitter:description" content="${description}">`,
  ].join('\n')
}

function fillDeckSharePlaceholders(html: string, ctx: ShareContext): string {
  const shareText = encodeURIComponent(`${ctx.title} — ${ctx.shareUrl}`)
  const subject = encodeURIComponent(ctx.title)
  return html
    .split('__DOCIFY_SHARE_URL__').join(ctx.shareUrl)
    .split('__DOCIFY_SHARE_TEXT__').join(shareText)
    .split('__DOCIFY_SHARE_SUBJECT__').join(subject)
}

/**
 * Injects the elements every Docify document gets, regardless of template:
 * top bar, footer, OG/canonical tags, viewport meta and a system font stack.
 * Runs at request time so live view counts and the request's own host make it
 * into the page.
 */
export function injectSharedElements(html: string, ctx: ShareContext): string {
  const $ = cheerio.load(html)

  ensureViewportMeta($)
  $('head').append(buildOgTags(ctx))
  $('body').prepend(buildTopBar(ctx))
  $('body').append(buildFooter())

  let result = '<!DOCTYPE html>' + $.html()
  if (ctx.template === 'deck') result = fillDeckSharePlaceholders(result, ctx)
  return result
}
