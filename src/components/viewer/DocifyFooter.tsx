import Image from 'next/image'
import Link from 'next/link'

export function DocifyFooter() {
  return (
    <footer className="mt-20 border-t border-gray-100 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <Link
          href="/"
          className="group inline-flex items-center gap-2.5 rounded-2xl border border-gray-100 bg-gray-50 px-5 py-3 transition-all hover:border-brand-teal/30 hover:bg-brand-light/50 hover:shadow-teal-sm"
        >
          <Image src="/logo.svg" alt="Docify" width={22} height={22} />
          <div className="text-left">
            <p className="text-xs font-semibold text-gray-700 group-hover:text-brand-dark transition-colors">
              Made with Docify
            </p>
            <p className="text-[11px] text-gray-400">Convert your own PDF →</p>
          </div>
        </Link>
      </div>
    </footer>
  )
}
