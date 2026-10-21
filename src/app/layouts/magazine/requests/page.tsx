import type { Metadata } from 'next'
import Link from 'next/link'
import { poster, requests, type MockRequest, type MockStatus } from '../../data'

export const metadata: Metadata = { title: 'Magazine · Requests' }

const SECTIONS: [label: string, statuses: MockStatus[]][] = [
  ['Downloading & importing', ['Downloading', 'Importing']],
  ['Requested', ['Requested']],
  ['Stuck', ['Stuck']],
  ['Available', ['Available']],
]

/** The one-line italic status under each listing. */
const line = (r: MockRequest) => {
  if (r.status === 'Downloading' || r.status === 'Importing') return `${r.status}, ${r.progress}%`
  if (r.status === 'Available') return `Available, ${r.sizeGb} GB`
  if (r.status === 'Stuck') return 'Stuck, nothing found yet'
  return 'Requested, waiting for a release'
}

export default function MagazineRequests() {
  return (
    <>
      <h1 className="lm-title">Listings</h1>
      <p className="lm-lede">Every Request, by where it is. The italic line is the latest word from the presses.</p>
      {SECTIONS.map(([label, statuses]) => {
        const rows = requests.filter((r) => statuses.includes(r.status))
        return (
          <section key={label} className="lm-section">
            <h2 className="lm-kicker">{label} <span className="n">{rows.length}</span></h2>
            <div className="lm-listings">
              {rows.map((r) => (
                <article key={r.id} className="lm-listing">
                  <div className="lm-poster" style={poster(r.title.hue)} />
                  <div>
                    <h3>{r.title.title} <small>{r.title.year}</small></h3>
                    <p className="lm-byline">Requested by {r.requestedBy} · {r.requestedAgo} · {r.detail}</p>
                    <p className={`lm-status st-${r.status.toLowerCase()}`}>{line(r)}</p>
                    <div className={`lm-rule st-${r.status.toLowerCase()}`}><i style={{ width: `${r.progress}%` }} /></div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )
      })}
      <p><Link href="/layouts/magazine" className="lm-btn">Request something new</Link></p>
    </>
  )
}
