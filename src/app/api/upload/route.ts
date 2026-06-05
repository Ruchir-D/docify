import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const url = formData.get('url') as string | null

    let pdfBuffer: Buffer
    let originalFilename: string

    if (file) {
      if (file.type !== 'application/pdf') {
        return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
      }
      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json({ error: 'File must be under 10MB' }, { status: 400 })
      }
      pdfBuffer = Buffer.from(await file.arrayBuffer())
      originalFilename = file.name
    } else if (url) {
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch URL')
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('pdf')) {
        return NextResponse.json({ error: 'URL does not point to a PDF' }, { status: 400 })
      }
      pdfBuffer = Buffer.from(await res.arrayBuffer())
      originalFilename = url.split('/').pop() || 'document.pdf'
    } else {
      return NextResponse.json({ error: 'Provide a file or URL' }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const storagePath = `pdfs/${Date.now()}-${originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const { error: storageError } = await supabase.storage
      .from('pdfs')
      .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: false })

    if (storageError) throw storageError

    const { data: upload, error: dbError } = await supabase
      .from('uploads')
      .insert({ original_filename: originalFilename, storage_path: storagePath })
      .select('id')
      .single()

    if (dbError) throw dbError

    return NextResponse.json({ uploadId: upload.id })
  } catch (err) {
    console.error('[upload]', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
