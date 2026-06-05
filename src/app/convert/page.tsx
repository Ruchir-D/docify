'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ConvertingSteps } from '@/components/convert/ConvertingSteps'

function ConvertContent() {
  const params = useSearchParams()
  const uploadId = params.get('uploadId') || ''
  const filename = params.get('filename') || ''

  if (!uploadId) {
    return (
      <div className="text-center animate-fade-in">
        <p className="text-white/50 text-sm">No upload found.</p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-brand-teal hover:underline"
        >
          ← Start over
        </Link>
      </div>
    )
  }

  return <ConvertingSteps uploadId={uploadId} filename={filename} />
}

export default function ConvertPage() {
  return (
    <main className="bg-upload min-h-screen flex flex-col items-center">
      {/* Logo */}
      <nav className="w-full flex items-center justify-center py-6 animate-fade-in">
        <Link href="/" className="flex items-center gap-2.5 group">
          <Image src="/logo.svg" alt="Docify" width={30} height={30} />
          <span className="font-syne text-lg font-bold text-white group-hover:text-white/80 transition-colors">
            docify
          </span>
        </Link>
      </nav>

      {/* Content */}
      <div className="flex flex-1 items-center justify-center w-full px-5 pb-24">
        <div className="w-full max-w-sm animate-slide-up" style={{ animationDelay: '80ms' }}>
          <Suspense
            fallback={
              <div className="flex justify-center">
                <div className="h-8 w-8 rounded-full border-2 border-brand-teal border-t-transparent animate-spin" />
              </div>
            }
          >
            <ConvertContent />
          </Suspense>
        </div>
      </div>
    </main>
  )
}
