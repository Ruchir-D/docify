'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'

type State = 'idle' | 'drag-over' | 'selected' | 'uploading'

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DropZone() {
  const [state, setState] = useState<State>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFile = useCallback((f: File) => {
    setError(null)
    if (f.type !== 'application/pdf') {
      setError('Only PDF files are supported.')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('File must be under 10 MB.')
      return
    }
    setFile(f)
    setState('selected')
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const f = e.dataTransfer.files[0]
      if (f) handleFile(f)
      else setState('idle')
    },
    [handleFile],
  )

  const handleConvert = async () => {
    if (!file) return
    setState('uploading')
    setError(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Upload failed')
      router.push(`/convert?uploadId=${json.uploadId}&filename=${encodeURIComponent(file.name)}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Try again.')
      setState('selected')
    }
  }

  const isDragOver = state === 'drag-over'
  const isSelected = state === 'selected'
  const isUploading = state === 'uploading'

  return (
    <div className="w-full">
      {/* Drop area */}
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && !isUploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!isUploading) setState('drag-over') }}
        onDragLeave={() => setState(file ? 'selected' : 'idle')}
        onDrop={handleDrop}
        onClick={() => !isUploading && inputRef.current?.click()}
        className={[
          'relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200 outline-none',
          isDragOver
            ? 'border-brand-teal bg-brand-teal/10 scale-[1.008] shadow-teal-ring'
            : isSelected
            ? 'border-brand-teal/50 bg-white/4'
            : 'border-white/14 bg-white/3 hover:border-white/28 hover:bg-white/5 dropzone-idle',
          isSelected ? 'py-6 px-6' : 'py-10 px-6',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {isSelected && file ? (
          /* ── File selected state ── */
          <div className="animate-scale-in flex items-center gap-4">
            {/* File icon */}
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-teal/20 ring-1 ring-brand-teal/30">
              <svg className="h-5 w-5 text-brand-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{file.name}</p>
              <p className="mt-0.5 text-xs text-white/40">{formatBytes(file.size)} · PDF</p>
            </div>
            {/* Change */}
            <button
              onClick={(e) => { e.stopPropagation(); setState('idle'); setFile(null) }}
              className="flex-shrink-0 rounded-lg p-1.5 text-white/30 hover:bg-white/10 hover:text-white/70 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          /* ── Idle / drag-over state ── */
          <div className="flex flex-col items-center gap-3 text-center">
            <div className={[
              'relative flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-200',
              isDragOver ? 'bg-brand-teal/25 scale-110' : 'bg-white/8',
            ].join(' ')}>
              {isDragOver && (
                <span className="absolute inset-0 rounded-2xl bg-brand-teal/20 animate-ping-slow" />
              )}
              <svg className={`h-6 w-6 transition-colors ${isDragOver ? 'text-brand-teal' : 'text-white/50'}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white">
                {isDragOver ? 'Release to upload' : 'Drop your PDF here'}
              </p>
              <p className="mt-1 text-xs text-white/35">or click to browse · up to 10 MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="mt-2.5 flex items-center gap-1.5 text-xs text-red-400 animate-slide-up-sm">
          <svg className="h-3.5 w-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}

      {/* Convert button */}
      {isSelected && (
        <div className="mt-3 animate-slide-up-sm">
          <Button size="lg" onClick={handleConvert} loading={isUploading} className="w-full">
            {isUploading ? 'Uploading…' : (
              <>
                Convert to Doc
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
