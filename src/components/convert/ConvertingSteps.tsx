'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ProgressRing } from '@/components/ui/ProgressRing'

const STEPS = [
  {
    id: 'read',
    label: 'Reading your PDF',
    sublabel: 'Extracting text & structure',
  },
  {
    id: 'ai',
    label: 'Claude is analyzing',
    sublabel: 'Converting to beautiful HTML',
  },
  {
    id: 'link',
    label: 'Generating your link',
    sublabel: 'Finishing up…',
  },
]

type StepStatus = 'pending' | 'active' | 'done'

interface ConvertingStepsProps {
  uploadId: string
  filename: string
}

export function ConvertingSteps({ uploadId, filename }: ConvertingStepsProps) {
  const [steps, setSteps] = useState<Record<string, StepStatus>>({
    read: 'active',
    ai: 'pending',
    link: 'pending',
  })
  const [progress, setProgress] = useState(5)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    let intervalRef: ReturnType<typeof setInterval> | null = null

    const run = async () => {
      // Step 1: reading PDF (quick)
      await delay(1600)
      if (cancelled) return
      setSteps({ read: 'done', ai: 'active', link: 'pending' })
      setProgress(28)

      // Animate progress slowly while Claude works
      intervalRef = startProgressAnimation(28, 87, 42000, setProgress)

      try {
        const res = await fetch('/api/convert', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId }),
        })

        if (intervalRef) clearInterval(intervalRef)
        if (cancelled) return

        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Conversion failed')

        // Step 3: generating link
        setSteps({ read: 'done', ai: 'done', link: 'active' })
        setProgress(95)

        await delay(600)
        if (cancelled) return

        setSteps({ read: 'done', ai: 'done', link: 'done' })
        setProgress(100)

        await delay(450)
        if (!cancelled) router.push(`/d/${json.slug}`)
      } catch (err) {
        if (intervalRef) clearInterval(intervalRef)
        if (!cancelled) setError(err instanceof Error ? err.message : 'Conversion failed')
      }
    }

    run()
    return () => {
      cancelled = true
      if (intervalRef) clearInterval(intervalRef)
    }
  }, [uploadId, router])

  if (error) {
    return (
      <div className="flex flex-col items-center gap-5 text-center animate-fade-in">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 ring-1 ring-red-500/30">
          <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-white">Conversion failed</p>
          <p className="mt-1 text-sm text-white/45">{error}</p>
        </div>
        <button
          onClick={() => router.push('/')}
          className="inline-flex items-center gap-1.5 text-sm text-brand-teal hover:underline"
        >
          ← Try again
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      {/* Progress ring */}
      <div className="relative flex items-center justify-center">
        <ProgressRing progress={progress} size={120} strokeWidth={5} />
        <div className="absolute flex flex-col items-center">
          <span className="font-syne text-2xl font-bold text-white leading-none">
            {Math.round(progress)}
          </span>
          <span className="text-[11px] text-white/35 mt-0.5">%</span>
        </div>
      </div>

      {/* Steps */}
      <div className="mt-8 w-full space-y-0">
        {STEPS.map((step, i) => {
          const status = steps[step.id]
          const isLast = i === STEPS.length - 1
          return (
            <div key={step.id} className="relative flex gap-3.5">
              {/* Connector line */}
              {!isLast && (
                <div
                  className="absolute left-[13px] top-7 w-px"
                  style={{
                    height: 'calc(100% - 4px)',
                    background: status === 'done'
                      ? 'rgba(29,158,117,0.4)'
                      : 'rgba(255,255,255,0.08)',
                    transition: 'background 0.6s ease',
                  }}
                />
              )}

              {/* Step icon */}
              <div className="relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center mt-0.5">
                {status === 'done' ? (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-teal shadow-teal-sm">
                    <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : status === 'active' ? (
                  <div className="relative">
                    <div className="h-7 w-7 rounded-full border-2 border-brand-teal border-t-transparent animate-spin" />
                    <div className="absolute inset-0 rounded-full bg-brand-teal/10 animate-ping-slow" />
                  </div>
                ) : (
                  <div className="h-7 w-7 rounded-full border-2 border-white/12 bg-white/4" />
                )}
              </div>

              {/* Text */}
              <div className="pb-6">
                <p className={`text-sm font-medium transition-all duration-300 ${
                  status === 'pending' ? 'text-white/25' : 'text-white'
                }`}>
                  {step.label}
                </p>
                {status === 'active' && (
                  <p className="mt-0.5 text-xs text-white/40 animate-fade-in">
                    {step.sublabel}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Filename */}
      {filename && (
        <p className="mt-2 truncate max-w-[240px] text-center text-[11px] text-white/25">
          {decodeURIComponent(filename)}
        </p>
      )}
    </div>
  )
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function startProgressAnimation(
  from: number,
  to: number,
  duration: number,
  setter: (v: number) => void,
): ReturnType<typeof setInterval> {
  const tickMs = 250
  const ticks = duration / tickMs
  const increment = (to - from) / ticks
  let current = from
  let count = 0

  const id = setInterval(() => {
    count++
    // Ease out: slow down as it approaches `to`
    const eased = from + (to - from) * (1 - Math.exp(-count * increment / (to - from) * 0.6))
    current = Math.min(eased, to)
    setter(current)
  }, tickMs)

  return id
}
