'use client'

import { useEffect, useState } from 'react'
import type { LiveDownload } from '@/lib/admin'

/** The Admin view's Downloading list, read again from qBittorrent every 3 seconds while the page is on screen. */
export function Downloads({ initial }: { initial: LiveDownload[] }) {
  const [rows, setRows] = useState(initial)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const load = () =>
      fetch('/api/downloads', { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
        .then(
          (r: LiveDownload[]) => {
            setRows(r)
            setFailed(false)
          },
          () => setFailed(true),
        )
    const timer = setInterval(() => document.hidden || load(), 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="rows">
      {failed && <small className="ar-sub">qBittorrent isn&apos;t responding, so this may be out of date.</small>}
      {rows.length === 0 && <small className="ar-sub">Nothing is downloading.</small>}
      {rows.map((d) => (
        <div className="rowi" key={d.hash}>
          {d.poster && <img className="ar-dl-art" src={d.poster} alt="" width={36} height={54} loading="lazy" decoding="async" />}
          <div className="grow">
            <span className="ar-name" title={d.release}>
              {d.title}
            </span>
            <small className="ar-sub ar-name">
              {[d.state, d.speed, d.eta && `${d.eta} left`, `${d.seeds} seeders · ${d.peers} peers`, d.by.length > 0 && `Requested by ${d.by.join(', ')}`]
                .filter(Boolean)
                .join(' · ')}
            </small>
            <div className="progress" role="progressbar" aria-label={`${d.title} progress`} aria-valuenow={d.percent} aria-valuemin={0} aria-valuemax={100}>
              <i style={{ width: `${d.percent}%` }} />
            </div>
          </div>
          <small>
            {d.percent}% · {d.done}
          </small>
        </div>
      ))}
    </div>
  )
}
