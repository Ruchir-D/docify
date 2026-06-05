import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    const supabase = getSupabaseAdmin()

    const { data: doc, error } = await supabase
      .from('documents')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    await supabase
      .from('documents')
      .update({ view_count: doc.view_count + 1 })
      .eq('id', doc.id)

    return NextResponse.json(doc)
  } catch (err) {
    console.error('[document]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
