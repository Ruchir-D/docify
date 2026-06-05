import Image from 'next/image'
import Link from 'next/link'
import { CopyButton } from '@/components/ui/CopyButton'
import type { Document } from '@/types'

interface ViewerTopBarProps {
  document: Document
  shareUrl: string
}

export function ViewerTopBar({ document, shareUrl }: ViewerTopBarProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-13 items-center justify-between gap-4 bg-brand-teal px-4 md:px-6"
      style={{ height: '52px' }}>
      {/* Left: logo + title */}
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/" className="flex-shrink-0 opacity-90 hover:opacity-100 transition-opacity">
          <Image src="/logo.svg" alt="Docify" width={26} height={26} />
        </Link>
        <div className="hidden sm:flex items-center gap-2.5 min-w-0">
          <span className="text-white/30 text-xs select-none">/</span>
          <h1 className="text-sm font-medium text-white truncate max-w-[180px] md:max-w-xs lg:max-w-sm">
            {document.title}
          </h1>
        </div>
      </div>

      {/* Right: stats + actions */}
      <div className="flex flex-shrink-0 items-center gap-2 md:gap-4">
        {/* Stats */}
        <div className="hidden md:flex items-center gap-3 text-[11px] text-white/50">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {document.page_count}p
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {document.view_count.toLocaleString()}
          </span>
        </div>

        {/* Divider */}
        <div className="hidden md:block h-4 w-px bg-white/20" />

        {/* Copy link */}
        <CopyButton url={shareUrl} />

        {/* Divider */}
        <div className="hidden sm:block h-4 w-px bg-white/20" />

        {/* Convert own PDF */}
        <Link
          href="/"
          className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/25 transition-colors"
        >
          Convert your PDF →
        </Link>
      </div>
    </header>
  )
}
