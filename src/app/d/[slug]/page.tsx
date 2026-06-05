import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { getSupabaseAdmin } from '@/lib/supabase'
import { extractHeadings } from '@/lib/htmlParser'
import { ViewerTopBar } from '@/components/viewer/ViewerTopBar'
import { TableOfContents } from '@/components/viewer/TableOfContents'
import { DocumentViewer } from '@/components/viewer/DocumentViewer'
import { DocifyFooter } from '@/components/viewer/DocifyFooter'

interface PageProps {
  params: Promise<{ slug: string }>
}

async function getDocument(slug: string) {
  const supabase = getSupabaseAdmin()
  const { data: doc, error } = await supabase
    .from('documents')
    .select('*')
    .eq('slug', slug)
    .single()

  if (error || !doc) return null

  supabase
    .from('documents')
    .update({ view_count: (doc.view_count ?? 0) + 1 })
    .eq('id', doc.id)
    .then(() => {})

  return doc
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const doc = await getDocument(slug)
  if (!doc) return { title: 'Document not found — Docify' }
  return {
    title: `${doc.title} — Docify`,
    description: `Read "${doc.title}" — converted from PDF by Docify`,
    openGraph: {
      title: doc.title,
      description: `Read "${doc.title}" — converted by Docify`,
      type: 'article',
    },
  }
}

export default async function DocumentPage({ params }: PageProps) {
  const { slug } = await params
  const doc = await getDocument(slug)
  if (!doc) notFound()

  const headings = extractHeadings(doc.html_content)
  const hasToC = headings.length >= 3

  const headersList = await headers()
  const host = headersList.get('host') || 'docify.app'
  const protocol = host.startsWith('localhost') ? 'http' : 'https'
  const shareUrl = `${protocol}://${host}/d/${slug}`

  return (
    <div className="min-h-screen bg-white">
      <ViewerTopBar document={doc} shareUrl={shareUrl} />

      {hasToC && <TableOfContents headings={headings} />}

      <div
        className="pt-[52px]"
        style={{ paddingLeft: hasToC ? undefined : undefined }}
      >
        <div className={hasToC ? 'lg:pl-56' : ''}>
          <main className="mx-auto max-w-2xl px-6 py-12 md:px-10 md:py-16 lg:max-w-3xl">
            <DocumentViewer html={doc.html_content} />
            <DocifyFooter />
          </main>
        </div>
      </div>
    </div>
  )
}
