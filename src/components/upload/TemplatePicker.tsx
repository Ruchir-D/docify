'use client'

import type { TemplateChoice } from '@/types'

const OPTIONS: { value: TemplateChoice; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'Let Claude pick the best fit' },
  { value: 'document', label: 'Document', hint: 'Reports, proposals, papers' },
  { value: 'resume', label: 'Resume', hint: 'CVs, bios, profiles' },
  { value: 'deck', label: 'Deck', hint: 'Pitches & proposals' },
  { value: 'interactive', label: 'Interactive', hint: 'Explorable, animated pages' },
]

interface TemplatePickerProps {
  value: TemplateChoice
  onChange: (value: TemplateChoice) => void
}

export function TemplatePicker({ value, onChange }: TemplatePickerProps) {
  return (
    <div className="w-full">
      <p className="mb-2.5 text-center text-[11px] uppercase tracking-widest text-white/30">
        Choose a style
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {OPTIONS.map((opt) => {
          const isActive = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              title={opt.hint}
              aria-pressed={isActive}
              className={[
                'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-150',
                isActive
                  ? 'border-brand-teal/50 bg-brand-teal/20 text-white shadow-teal-sm'
                  : 'border-white/10 bg-white/4 text-white/50 hover:border-white/20 hover:text-white/80',
              ].join(' ')}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
