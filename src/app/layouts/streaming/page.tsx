import type { Metadata } from 'next'
import Link from 'next/link'
import { poster, recentlyAdded, requests, trending, type MockRequest, type MockTitle } from '../data'

export const metadata: Metadata = { title: 'Streaming · Home' }

const featured = requests[0]
/** The poster gradient, darkened towards the bottom-left corner where the text sits. */
const backdrop = (hue: number) => ({
  background: `linear-gradient(0deg, #0f0f12 0%, rgb(15 15 18 / .45) 50%, rgb(15 15 18 / 0) 100%), linear-gradient(90deg, rgb(15 15 18 / .85) 0%, rgb(15 15 18 / .3) 60%, rgb(15 15 18 / 0) 100%), ${poster(hue).background}`,
})
const requestOf = (t: MockTitle) => requests.find((r) => r.title.id === t.id)

export default function StreamingHome() {
  const t = featured.title
  return (
    <>
      <section className="st-hero" style={backdrop(t.hue)}>
        <small>Just became Available · Requested by {featured.requestedBy}</small>
        <h1>{t.title}</h1>
        <p className="st-meta"><span>{t.year}</span><span>{t.type}</span><span>{t.runtime}</span><span>★ {t.rating}</span><span>{t.genres.join(', ')}</span></p>
        <p className="st-overview">{t.overview}</p>
        <div className="st-actions">
          <button type="button" className="st-btn primary">▶ Open in Plex</button>
          <button type="button" className="st-btn">Details</button>
        </div>
      </section>
      <Row title="Requests" more="/layouts/streaming/requests">
        {requests.map((r) => <Card key={r.id} t={r.title} r={r} sub={`${r.requestedBy} · ${r.requestedAgo}`} />)}
      </Row>
      <Row title="Trending this week">
        {trending.map((t) => <Card key={t.id} t={t} r={requestOf(t)} />)}
      </Row>
      <Row title="Recently added">
        {recentlyAdded.map((t) => <Card key={t.id} t={t} r={requestOf(t)} />)}
      </Row>
    </>
  )
}

function Row({ title, more, children }: { title: string; more?: string; children: React.ReactNode }) {
  return (
    <section className="st-row">
      <div className="st-row-head"><h2>{title}</h2>{more && <Link href={more}>See all</Link>}</div>
      <div className="st-strip">{children}</div>
    </section>
  )
}

/** A poster with its Request's status in the corner, or a Request chip when nobody has asked for it yet. */
function Card({ t, r, sub }: { t: MockTitle; r?: MockRequest; sub?: string }) {
  const s = r?.status.toLowerCase()
  const busy = r?.status === 'Downloading' || r?.status === 'Importing'
  return (
    <div className="st-card">
      <div className="st-poster" style={poster(t.hue)}>
        {r ? <span className={`st-chip st-${s}`}>{r.status}</span> : <button type="button" className="st-chip st-ask">+ Request</button>}
        {busy && <span className={`st-bar st-${s}`}><i style={{ width: `${r.progress}%` }} /></span>}
      </div>
      <div className="st-cap"><b>{t.title}</b><small>{sub ?? `${t.year} · ${t.type}`}</small></div>
    </div>
  )
}
