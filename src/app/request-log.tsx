'use client'

import { useEffect, useState } from 'react'

/** How long a running step has taken so far, ticking every second. */
export function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(since)
  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const s = Math.max(0, Math.floor((now - since) / 1000))
  const [h, m, sec] = [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
  return <span className="badge">{h ? `${h} h ${m} min` : `${m}:${String(sec).padStart(2, '0')}`} so far</span>
}

/** Copies the whole log as plain text. */
export function CopyLog({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      className="btn small"
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }
    >
      {copied ? 'Copied' : 'Copy log'}
    </button>
  )
}
