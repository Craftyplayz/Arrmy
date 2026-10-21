import type { Metadata } from 'next'
import { admin } from '../../data'

export const metadata: Metadata = { title: 'Pipeline · Admin' }

/** Where each service sits in the plant diagram: left as a % of the width, top in px. */
const POS: Record<string, [left: number, top: number]> = { Prowlarr: [12, 115], Radarr: [38, 40], Sonarr: [38, 115], LazyLibrarian: [38, 190], qBittorrent: [64, 115], Plex: [88, 115] }
const WIRES: [from: string, to: string][] = [['Prowlarr', 'Radarr'], ['Prowlarr', 'Sonarr'], ['Prowlarr', 'LazyLibrarian'], ['Radarr', 'qBittorrent'], ['Sonarr', 'qBittorrent'], ['LazyLibrarian', 'qBittorrent'], ['qBittorrent', 'Plex']]
/** Download speed per hour over the last day, MB/s: made up, like the rest of the data. */
const SPEEDS = [2, 3, 5, 4, 6, 9, 12, 8, 7, 11, 14, 16, 13, 10, 9, 12, 15, 17, 16, 14, 12, 13, 16, 12]

export default function PipelineAdmin() {
  const ok = (name: string) => admin.services.find((s) => s.name === name)?.ok ?? false
  const { counts } = admin
  return (
    <>
      <div className="lp-head"><h1>Plant status</h1><p>{counts.requested} Requested · {counts.downloading} Downloading · {counts.importing} Importing · {counts.available} Available · {counts.stuck} Stuck</p></div>
      <div className="lp-admin">
        <section className="lp-panel wide">
          <h2>Services <small>Green is answering, red is not</small></h2>
          <div className="lp-plant">
            <svg aria-hidden="true">
              {WIRES.map(([a, b]) => {
                const down = !ok(a) || !ok(b)
                return <line key={a + b} x1={`${POS[a][0]}%`} y1={POS[a][1]} x2={`${POS[b][0]}%`} y2={POS[b][1]} stroke={down ? '#ff5c5c' : '#4ea1ff'} strokeWidth={2} strokeOpacity={0.8} strokeDasharray={down ? '5 4' : undefined} />
              })}
            </svg>
            {admin.services.map((s) => (
              <div key={s.name} className={s.ok ? 'lp-svc' : 'lp-svc down'} style={{ left: `${POS[s.name][0]}%`, top: POS[s.name][1] }}>
                <b><i className={s.ok ? 'lp-dot available' : 'lp-dot stuck'} />{s.name}</b>
                <small>{s.ok ? `v${s.version}` : 'Not answering'}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-panel">
          <h2>Blockages <small>{admin.problems.length} to fix</small></h2>
          <div className="lp-list">
            {admin.problems.map((p) => (
              <div key={p.title} className="lp-row">
                <span className="lp-stage">{p.what.startsWith('Import') ? 'Import' : 'Indexer'}</span>
                <div className="grow"><b>{p.title}</b><small>{p.what}</small></div>
                <button type="button" className="lp-btn danger">{p.fix}</button>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-panel">
          <h2>Throughput <small>Download speed, last 24 h, MB/s</small></h2>
          <div className="lp-spark" role="img" aria-label="Download speed over the last 24 hours, peaking at 17 MB/s">
            {SPEEDS.map((v, i) => <i key={i} style={{ height: `${(v / 18) * 100}%` }} title={`${v} MB/s`} />)}
          </div>
          <div className="lp-axis"><span>24 h ago</span><span>12 h ago</span><span>now</span></div>
          <div className="lp-list">
            {admin.downloads.map((d) => (
              <div key={d.title} className="lp-row">
                <div className="grow">
                  <b>{d.title}</b>
                  <div className="lp-meta"><span>{d.speedMbs} MB/s</span><span>{d.eta} left</span><span>{d.seeds} seeds</span></div>
                  <div className="lp-bar"><i style={{ width: `${d.progress}%` }} /></div>
                </div>
                <span className="num">{d.progress}%</span>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-panel">
          <h2>Storage</h2>
          {admin.disks.map((d) => {
            const pct = Math.round((d.usedTb / d.totalTb) * 100)
            return (
              <div key={d.name} className="lp-disk">
                <span>{d.name}<small>{d.usedTb} of {d.totalTb} TB · {pct}%</small></span>
                <div className="lp-bar"><i className={pct > 90 ? 'red' : pct > 75 ? 'gold' : ''} style={{ width: `${pct}%` }} /></div>
              </div>
            )
          })}
        </section>

        <section className="lp-panel">
          <h2>Requesters</h2>
          <table className="lp-table">
            <thead><tr><th>Name</th><th className="num">Requests</th><th>Role</th></tr></thead>
            <tbody>
              {admin.requesters.map((p) => (
                <tr key={p.name}><td>{p.name}</td><td className="num">{p.requests}</td><td>{p.admin ? <span className="lp-tag">Admin</span> : 'Requester'}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  )
}
