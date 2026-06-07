import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { convertPdfToHtml } from '@/lib/claude'
import { generateUniqueSlug } from '@/lib/slugify'
import type { TemplateChoice } from '@/types'

export const maxDuration = 60

const VALID_CHOICES: TemplateChoice[] = ['document', 'resume', 'deck', 'interactive', 'auto']

export async function POST(req: NextRequest) {
  try {
    const { uploadId, template } = await req.json()
    if (!uploadId) {
      return NextResponse.json({ error: 'uploadId is required' }, { status: 400 })
    }
    const templateChoice: TemplateChoice = VALID_CHOICES.includes(template) ? template : 'auto'

    const supabase = getSupabaseAdmin()

    const { data: upload, error: uploadError } = await supabase
      .from('uploads')
      .select('*')
      .eq('id', uploadId)
      .single()

    if (uploadError || !upload) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 })
    }

    const { data: pdfData, error: storageError } = await supabase.storage
      .from('pdfs')
      .download(upload.storage_path)

    if (storageError || !pdfData) throw storageError

    const pdfBuffer = Buffer.from(await pdfData.arrayBuffer())
    const { title, pageCount, html, template: resolvedTemplate } = await convertPdfToHtml(pdfBuffer, templateChoice)

    const slug = generateUniqueSlug(title)

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .insert({
        slug,
        title,
        html_content: html,
        page_count: pageCount,
        view_count: 0,
        template: resolvedTemplate,
      })
      .select('id, slug')
      .single()

    if (docError) throw docError

    await supabase
      .from('uploads')
      .update({ document_id: doc.id })
      .eq('id', uploadId)

    return NextResponse.json({ slug: doc.slug })
  } catch (err) {
    console.error('[convert]', err)
    return NextResponse.json({ error: 'Conversion failed' }, { status: 500 })
  }
}
