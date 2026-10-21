'use client'

import { useEffect, useRef, useState } from 'react'
import type { EpisodeRow } from '@/lib/episodes'

/**
 * A TV Request's episodes, each with its file and a progress bar, read again every 5 seconds. Inside a drawer it
 * loads only while the drawer is open, so a page of drawers doesn't ask Sonarr and qBittorrent about every show.
 */
export function EpisodeFiles({ id }: { id: number }) {
  const ref = useRef<HTMLElement>(null)
  const [rows, setRows] = useState<EpisodeRow[]>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const drawer = ref.current?.closest<HTMLElement>('[popover]')
    let timer: ReturnType<typeof setInterval> | undefined
    const load = () =>
      fetch(`/api/requests/${id}/files`, { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
        .then(
          (r: EpisodeRow[]) => {
            setRows(r)
            setFailed(false)
          },
          () => setFailed(true),
        )
    const toggle = () => {
      clearInterval(timer)
      if (drawer && !drawer.matches(':popover-open')) return
      load()
      timer = setInterval(() => document.hidden || load(), 5000)
    }
    // on the Request page it isn't in a drawer, so it loads straight away
    if (!drawer) {
      toggle()
      return () => clearInterval(timer)
    }
    toggle() // the drawer can already be open when the page re-renders after a form
    drawer.addEventListener('toggle', toggle)
    return () => {
      drawer.removeEventListener('toggle', toggle)
      clearInterval(timer)
    }
  }, [id])

  const seasons = [...new Set(rows?.map((r) => r.season))]
  return (
    <section ref={ref}>
      {failed && <small className="ar-sub">Sonarr isn&apos;t responding{rows && ', so this may be out of date'}.</small>}
      {!rows && !failed && <small className="ar-sub">Loading files...</small>}
      {rows?.length === 0 && <small className="ar-sub">Sonarr has no episodes for this show.</small>}
      {seasons.map((season) => {
        const episodes = rows!.filter((r) => r.season === season)
        return (
          <div key={season}>
            <h3 className="ar-h ar-h3">
              Season {season}
              <span className="n">
                {episodes.filter((e) => e.state === 'Available').length} of {episodes.length} available
              </span>
            </h3>
            <div className="rows">
              {episodes.map((e) => (
                <div className="rowi" key={e.episode}>
                  <div className="grow">
                    <span className="ar-name">
                      {e.episode}. {e.title}
                    </span>
                    <small className="ar-sub ar-name" title={e.file}>
                      {[e.state, e.file].filter(Boolean).join(' · ')}
                    </small>
                    <div
                      className="progress"
                      role="progressbar"
                      aria-label={`Episode ${e.episode} progress`}
                      aria-valuenow={e.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <i style={{ width: `${e.progress}%` }} />
                    </div>
                  </div>
                  <small>{e.progress}%</small>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </section>
  )
}
