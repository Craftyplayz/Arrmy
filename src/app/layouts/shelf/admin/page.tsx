import type { Metadata } from 'next'
import { admin, poster, titles } from '../../data'

export const metadata: Metadata = { title: 'Shelf · Admin' }

const HUES: Record<string, number> = { Crafty: 200, Sam: 120, Jo: 330, Alex: 40 }
/** Problems and downloads name a title with an episode or narrator after it, so match on the start. */
const hue = (name: string) => titles.find((t) => name.startsWith(t.title))?.hue ?? 0
const COUNTS: [label: string, n: number][] = [
  ['Requested', admin.counts.requested],
  ['Downloading', admin.counts.downloading],
  ['Importing', admin.counts.importing],
  ['Available', admin.counts.available],
  ['Stuck', admin.counts.stuck],
]

export default function ShelfAdmin() {
  return (
    <>
      <h1>Back room</h1>
      <p className="lede">What needs fixing, what's coming in, how much shelf space is left, the suppliers and the readers.</p>
      <div className="plaques">{COUNTS.map(([label, n]) => <span key={label} className="plaque"><b>{n}</b>{label}</span>)}</div>

      <section className="shelf">
        <h2>Needs fixing <small>{admin.problems.length}</small></h2>
        <div className="row">
          {admin.problems.map((p) => (
            <div key={p.title} className="item">
              <div className="cover dim" style={poster(hue(p.title))}><span className="tag red">Needs fixing</span><b>{p.title}</b></div>
              <div className="plank" />
              <div className="cap wide">
                <b>{p.title}</b>
                <span className="wrap">{p.what}</span>
                <button type="button" className="btn primary small">{p.fix}</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="shelf">
        <h2>Downloading <small>{admin.downloads.length}</small></h2>
        <div className="row">
          {admin.downloads.map((d) => (
            <div key={d.title} className="item">
              <div className="cover" style={poster(hue(d.title))}><b>{d.title}</b><span className="strip"><i style={{ width: `${d.progress}%` }} /></span></div>
              <div className="plank" />
              <div className="cap wide">
                <b>{d.title}</b>
                <span>{d.speedMbs} MB/s · {d.eta} left · {d.progress}%</span>
                <span>{d.seeds} seeds</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <h2>Shelf space</h2>
      <div className="gauges">
        {admin.disks.map((d) => {
          const pct = Math.round((d.usedTb / d.totalTb) * 100)
          return (
            <div key={d.name} className="gauge">
              <h3>{d.name} <span>{pct}% full</span></h3>
              <div className="bar"><i style={{ width: `${pct}%` }} /></div>
              <small>{d.usedTb} TB of {d.totalTb} TB · {(d.totalTb - d.usedTb).toFixed(1)} TB free</small>
            </div>
          )
        })}
      </div>

      <h2>Suppliers</h2>
      <div className="plaques">
        {admin.services.map((s) => (
          <span key={s.name} className="plaque"><i className={s.ok ? 'lamp on' : 'lamp off'} />{s.name}<small>{s.ok ? s.version : 'not responding'}</small></span>
        ))}
      </div>

      <h2>Readers</h2>
      <div className="readers">
        {admin.requesters.map((p) => (
          <div key={p.name} className="reader">
            <i className="avatar" style={poster(HUES[p.name])}>{p.name[0]}</i>
            <span className="grow"><b>{p.name}</b><small>{p.requests} {p.requests === 1 ? 'Request' : 'Requests'}</small></span>
            {p.admin && <span className="badge">Admin</span>}
          </div>
        ))}
      </div>
    </>
  )
}
