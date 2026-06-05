import Link from 'next/link'
import Image from 'next/image'

export default function NotFound() {
  return (
    <main className="bg-upload min-h-screen flex flex-col items-center justify-center px-5 text-center">
      <div className="animate-slide-up flex flex-col items-center gap-6">
        <Image src="/logo.svg" alt="Docify" width={40} height={40} />
        <div>
          <h1 className="font-syne text-5xl font-bold text-white">404</h1>
          <p className="mt-2 text-white/50">This document doesn&apos;t exist or has been removed.</p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-teal-dark transition-colors"
        >
          ← Convert a PDF
        </Link>
      </div>
    </main>
  )
}
