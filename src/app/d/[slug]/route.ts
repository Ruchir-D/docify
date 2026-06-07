import { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { getSupabaseAdmin } from '@/lib/supabase'
import { injectSharedElements } from '@/lib/htmlParser'

interface RouteParams {
  params: Promise<{ slug: string }>
}

const NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Document not found — Docify</title>
<style>
  body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;background:#04342C;background-image:radial-gradient(ellipse 80% 55% at 50% 38%,rgba(29,158,117,.18) 0%,transparent 65%);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#fff;text-align:center;padding:24px}
  h1{font-size:48px;font-weight:800;margin:0}
  p{margin:8px 0 0;color:rgba(255,255,255,.5);font-size:15px}
  a{display:inline-flex;align-items:center;gap:8px;margin-top:8px;border-radius:12px;background:#1D9E75;color:#fff;font-weight:600;font-size:14px;text-decoration:none;padding:11px 20px}
  a:hover{background:#178a65}
</style>
</head>
<body>
  <div>
    <h1>404</h1>
    <p>This document doesn't exist or has been removed.</p>
  </div>
  <a href="/">← Convert a PDF</a>
</body>
</html>`

function notFoundResponse(): Response {
  return new Response(NOT_FOUND_HTML, {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { slug } = await params
  const supabase = getSupabaseAdmin()

  const { data: doc, error } = await supabase.from('documents').select('*').eq('slug', slug).single()
  if (error || !doc) return notFoundResponse()

  const viewCount = (doc.view_count ?? 0) + 1
  supabase
    .from('documents')
    .update({ view_count: viewCount })
    .eq('id', doc.id)
    .then(() => {})

  const headersList = await headers()
  const host = headersList.get('host') || 'docify.app'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const shareUrl = `${protocol}://${host}/d/${slug}`

  const html = injectSharedElements(doc.html_content, {
    template: doc.template,
    title: doc.title,
    pageCount: doc.page_count,
    viewCount,
    shareUrl,
  })

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
