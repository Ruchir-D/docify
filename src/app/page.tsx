import Image from 'next/image'
import { UploadCard } from '@/components/upload/UploadCard'

export default function HomePage() {
  return (
    <main className="bg-upload min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-2.5 animate-fade-in">
          <Image src="/logo.svg" alt="Docify" width={32} height={32} priority />
          <span className="font-syne text-lg font-bold text-white tracking-tight">docify</span>
        </div>
        <a
          href="https://github.com"
          className="hidden sm:flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
          </svg>
          GitHub
        </a>
      </nav>

      {/* Hero */}
      <div className="flex flex-1 flex-col items-center justify-center px-5 pb-16 pt-8">
        {/* Badge */}
        <div
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-white/60 animate-fade-in"
          style={{ animationDelay: '80ms' }}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-teal" />
          Powered by Claude AI
        </div>

        {/* Headline */}
        <div className="animate-slide-up text-center" style={{ animationDelay: '120ms' }}>
          <h1 className="font-syne text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl">
            PDF <span className="text-brand-teal">→</span> Beautiful Doc
          </h1>
          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-white/50 sm:text-lg">
            Drop any PDF and get a clean, shareable web document in seconds.
          </p>
        </div>

        {/* Upload card */}
        <div
          className="mt-10 flex w-full justify-center animate-slide-up"
          style={{ animationDelay: '200ms' }}
        >
          <UploadCard />
        </div>

        {/* Features */}
        <div
          className="mt-10 flex items-center gap-6 animate-fade-in"
          style={{ animationDelay: '360ms' }}
        >
          {[
            {
              icon: (
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              ),
              label: 'Instant',
            },
            {
              icon: (
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.1-1.1" />
                </svg>
              ),
              label: 'Shareable',
            },
            {
              icon: (
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              ),
              label: 'Beautiful',
            },
          ].map((f, i) => (
            <div key={f.label} className="flex items-center gap-2 text-white/40" style={{ animationDelay: `${400 + i * 60}ms` }}>
              {f.icon}
              <span className="text-xs font-medium">{f.label}</span>
              {i < 2 && <span className="ml-6 text-white/15">·</span>}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
