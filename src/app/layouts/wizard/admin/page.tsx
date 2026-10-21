import type { Metadata } from 'next'
import { admin, poster } from '../../data'

export const metadata: Metadata = { title: 'One thing at a time · Admin' }

const HUES = [200, 30, 300, 140] // one avatar colour per Requester, in the data's order

export default function WizardAdmin() {
  const { problems, downloads, disks, services, requesters } = admin
  const down = services.filter((s) => !s.ok)
  return (
    <div className="wz-page wide">
      <h1 className="wz-title">What needs you</h1>
      <p className="wz-lede">{problems.length} problems to fix, {downloads.length} downloading, {down.length} service down.</p>

      {problems.map((p) => (
        <section key={p.title} className="wz-problem">
          <div>
            <h3>{p.title}</h3>
            <p>{p.what}</p>
          </div>
          <button type="button" className="wz-btn">{p.fix}</button>
        </section>
      ))}

      <h2 className="wz-h">Downloading now <small>{downloads.length}</small></h2>
      {downloads.map((d) => (
        <section key={d.title} className="wz-dl">
          <div className="wz-dl-top">
            <h3>{d.title}</h3>
            <span>{d.speedMbs} MB/s · {d.eta} left · {d.seeds} seeds</span>
          </div>
          <div className="wz-bar"><i style={{ width: `${d.progress}%` }} /></div>
        </section>
      ))}

      <h2 className="wz-h">Disks</h2>
      <div className="wz-disks">
        {disks.map((d) => {
          const pct = Math.round((d.usedTb / d.totalTb) * 100)
          return (
            <div key={d.name} className="wz-disk">
              <b>{pct}%</b>
              <span>{d.name} · {d.usedTb} of {d.totalTb} TB used</span>
              <div className="wz-bar"><i style={{ width: `${pct}%` }} /></div>
            </div>
          )
        })}
      </div>

      <h2 className="wz-h">Services</h2>
      <div className="wz-services">
        {services.map((s) => (
          <div key={s.name} className={s.ok ? 'wz-service' : 'wz-service down'}>
            <i />{s.name}<small>{s.ok ? s.version : 'not responding'}</small>
          </div>
        ))}
      </div>

      <h2 className="wz-h">Requesters</h2>
      <div className="wz-people">
        {requesters.map((r, i) => (
          <div key={r.name} className="wz-person">
            <span className="wz-avatar" style={poster(HUES[i])}>{r.name[0]}</span>
            <b>{r.name}</b>
            <span>{r.requests} Requests</span>
            {r.admin && <span className="wz-tag">Admin</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
