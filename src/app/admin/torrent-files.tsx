'use client'

import { useState } from 'react'
import type { SavedTorrent } from '@/lib/requestlog'

const day = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** Every saved .torrent, filtered as you type by release name, title or hash. */
export function TorrentFiles({ files }: { files: SavedTorrent[] }) {
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()
  const shown = term ? files.filter((f) => [f.release, f.title, f.hash].some((s) => s?.toLowerCase().includes(term))) : files
  return (
    <>
      <input
        className="field ar-torrent-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Release name, title or hash"
        aria-label="Search .torrent files"
      />
      {shown.length === 0 && <p className="muted">Nothing matches “{q}”.</p>}
      <div className="rows ar-torrent-list">
        {shown.map((f) => (
          <div className="rowi" key={f.hash}>
            <div className="grow">
              <span className="ar-name" title={f.release ?? f.hash}>
                <b>{f.release ?? f.hash}</b>
              </span>
              <span className="ar-sub">
                {[f.title ?? (f.release ? 'Request removed' : 'Not in any Request Log'), f.by && `Requested by ${f.by}`, `Grabbed ${day(f.at)}`].filter(Boolean).join(' · ')}
              </span>
            </div>
            <a className="btn small" href={`/api/torrents/${f.hash}`} download>
              Download
            </a>
          </div>
        ))}
      </div>
    </>
  )
}
