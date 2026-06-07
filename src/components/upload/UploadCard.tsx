'use client'

import { useState } from 'react'
import { DropZone } from '@/components/upload/DropZone'
import { UrlInput } from '@/components/upload/UrlInput'
import { TemplatePicker } from '@/components/upload/TemplatePicker'
import type { TemplateChoice } from '@/types'

export function UploadCard() {
  const [template, setTemplate] = useState<TemplateChoice>('auto')

  return (
    <div className="w-full max-w-lg">
      <div className="mb-5">
        <TemplatePicker value={template} onChange={setTemplate} />
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/4 p-1.5 shadow-glass backdrop-blur-sm">
        <DropZone template={template} />

        {/* Divider */}
        <div className="my-3 flex items-center gap-3 px-4">
          <div className="h-px flex-1 bg-white/8" />
          <span className="text-[11px] uppercase tracking-widest text-white/25">or paste a URL</span>
          <div className="h-px flex-1 bg-white/8" />
        </div>

        <div className="px-1.5 pb-1.5">
          <UrlInput template={template} />
        </div>
      </div>
    </div>
  )
}
