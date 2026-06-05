'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function UrlInput() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const isValidUrl = (v: string) => {
    try { new URL(v); return true } catch { return false }
  }

  const handleConvert = async () => {
    setError(null)
    if (!isValidUrl(url)) { setError('Enter a valid URL.'); return }
    setLoading(true)
    const formData = new FormData()
    formData.append('url', url)
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to fetch PDF')
      router.push(`/convert?uploadId=${json.uploadId}&filename=document.pdf`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed. Try again.')
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && url && !loading && handleConvert()}
          placeholder="https://example.com/file.pdf"
          className="min-w-0 flex-1 rounded-xl border border-white/12 bg-white/6 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-brand-teal/60 focus:bg-white/10 transition-all"
        />
        <button
          onClick={handleConvert}
          disabled={!url || loading}
          className="flex-shrink-0 rounded-xl bg-white/8 px-4 text-sm font-medium text-white/70 hover:bg-white/14 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {loading ? (
            <span className="inline-block h-4 w-4 rounded-full border-2 border-white/50 border-t-white animate-spin" />
          ) : 'Fetch'}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  )
}
