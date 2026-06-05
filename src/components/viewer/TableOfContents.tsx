'use client'

import { useState, useEffect } from 'react'
import type { Heading } from '@/types'

interface TableOfContentsProps {
  headings: Heading[]
}

export function TableOfContents({ headings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    if (headings.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-72px 0px -68% 0px', threshold: 0 },
    )

    headings.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [headings])

  if (headings.length === 0) return null

  return (
    <nav className="hidden lg:flex fixed left-0 top-[52px] h-[calc(100vh-52px)] w-56 flex-col border-r border-gray-100/80 bg-white py-6">
      <div className="flex-1 overflow-y-auto px-4">
        <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">
          Contents
        </p>
        <ul className="space-y-0.5">
          {headings.map((h) => {
            const isActive = activeId === h.id
            return (
              <li key={h.id} style={{ paddingLeft: `${(h.level - 1) * 12}px` }}>
                <a
                  href={`#${h.id}`}
                  className={[
                    'group relative block rounded-lg py-1.5 px-2 text-[12.5px] leading-snug transition-all duration-150 truncate',
                    isActive
                      ? 'toc-link-active bg-brand-teal/6 text-brand-teal font-medium pl-3.5'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800',
                  ].join(' ')}
                >
                  {h.text}
                </a>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Bottom: back to docify */}
      <div className="border-t border-gray-100 px-4 pt-4">
        <a
          href="/"
          className="flex items-center gap-2 rounded-lg px-2 py-2 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Convert your own PDF
        </a>
      </div>
    </nav>
  )
}
