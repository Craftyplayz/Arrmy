import type { Metadata } from 'next'
import { admin } from '../../data'
import { bar, Hints, tone } from '../bits'

export const metadata: Metadata = { title: 'Terminal · Admin' }

const { counts, disks, downloads, problems, services, requesters } = admin
/** A disk bar goes amber at 75% used and red at 90%. */
const diskTone = (used: number) => (used >= 90 ? 'lt-st-stuck' : used >= 75 ? 'lt-st-importing' : 'lt-st-available')

export default function Admin() {
  return (
    <>
      <p className="lt-prompt">
        <b>&gt;</b> status:{' '}
        {Object.entries(counts).map(([k, v]) => (
          <span key={k} className="lt-count">{v} <span className={tone(k)}>{k}</span></span>
        ))}
        <span className="lt-dim">· uptime 14d 03:12 · refresh 30s</span>
      </p>

      <div className="lt-panes">
        <fieldset className="lt-pane wide">
          <legend>DOWNLOADS</legend>
          <table className="lt-grid">
            <thead><tr><th>TITLE</th><th className="lt-num">SPEED</th><th>ETA</th><th className="lt-num">SEEDS</th><th>PROGRESS</th></tr></thead>
            <tbody>
              {downloads.map((d, i) => (
                <tr key={d.title} className={i === 0 ? 'is-sel' : undefined}>
                  <td>{d.title}</td>
                  <td className="lt-num">{d.speedMbs.toFixed(1)} MB/s</td>
                  <td>{d.eta}</td>
                  <td className="lt-num">{d.seeds}</td>
                  <td className="lt-st-downloading">{bar(d.progress, 24)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </fieldset>

        <fieldset className="lt-pane">
          <legend>PROBLEMS</legend>
          <ul className="lt-list">
            {problems.map((p) => (
              <li key={p.title}>
                <span className="lt-st-stuck">!</span> <b>{p.title}</b> <button type="button" className="lt-key">[f] {p.fix.toLowerCase()}</button>
                <br /><span className="lt-dim">  {p.what}</span>
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset className="lt-pane">
          <legend>DISKS</legend>
          {disks.map((d) => {
            const used = Math.round((d.usedTb / d.totalTb) * 100)
            return (
              <p key={d.name} className="lt-line">
                <span className="lt-k">{d.name}</span>
                <span className={diskTone(used)}>{bar(used, 20)}</span>
                <span className="lt-dim">{d.usedTb.toFixed(1)}/{d.totalTb.toFixed(1)} TB</span>
              </p>
            )
          })}
        </fieldset>

        <fieldset className="lt-pane">
          <legend>SERVICES</legend>
          <table className="lt-grid">
            <thead><tr><th>NAME</th><th>VERSION</th><th>STATE</th></tr></thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td>{s.version}</td>
                  <td className={s.ok ? 'lt-st-available' : 'lt-st-stuck'}>● {s.ok ? 'up' : 'down'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </fieldset>

        <fieldset className="lt-pane">
          <legend>REQUESTERS</legend>
          <table className="lt-grid">
            <thead><tr><th>NAME</th><th className="lt-num">REQUESTS</th><th>ROLE</th></tr></thead>
            <tbody>
              {requesters.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className="lt-num">{r.requests}</td>
                  <td className={r.admin ? 'lt-st-importing' : 'lt-dim'}>{r.admin ? 'admin' : 'requester'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </fieldset>
      </div>
      <Hints keys={[['[f]', 'fix'], ['[p]', 'pause'], ['[enter]', 'open in service'], ['[j/k]', 'move'], ['[h/l]', 'pane']]} />
    </>
  )
}
