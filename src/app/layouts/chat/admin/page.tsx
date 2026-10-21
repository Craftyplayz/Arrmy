import type { Metadata } from 'next'
import { admin } from '../../data'
import { Compose, Day, Embed, Head, Msg, Pinned, Progress } from '../bits'

export const metadata: Metadata = { title: 'Chat feed · Admin' }

const down = admin.services.filter((s) => !s.ok)

export default function ChatAdmin() {
  return (
    <>
      <Head name="admin" topic="Arrmy posts here when something needs the Admin, and a report every morning." />
      <Pinned>
        <b>{admin.problems.length} Problems</b> · {admin.counts.downloading} Downloading · {admin.counts.stuck} Stuck ·{' '}
        {down.length === 0 ? 'all services up' : `${down.map((s) => s.name).join(', ')} down`}
      </Pinned>
      <div className="lc-feed">
        <Day label="Today" />
        <Msg from="Arrmy" time="Today at 07:00">
          <p>Daily report: the disks, and who has asked for what.</p>
          <Embed tone="blurple" title="Daily report">
            <div className="lc-fields">
              {Object.entries(admin.counts).map(([k, n]) => <span key={k} className="lc-fld"><small>{k[0].toUpperCase() + k.slice(1)}</small>{n}</span>)}
            </div>
            <div className="lc-disks">
              {admin.disks.map((d) => {
                const pct = Math.round((d.usedTb / d.totalTb) * 100)
                return (
                  <div key={d.name} className="lc-disk">
                    <span>{d.name}</span>
                    <div className={`lc-prog t-${pct >= 80 ? 'gold' : 'green'}`}><i style={{ width: `${pct}%` }} /></div>
                    <small>{d.usedTb} of {d.totalTb} TB</small>
                  </div>
                )
              })}
            </div>
            <small className="lc-foot">Requests by person: {admin.requesters.map((p) => `${p.name} ${p.requests}`).join(' · ')}</small>
          </Embed>
        </Msg>
        <Msg from="Arrmy" time="Today at 08:12">
          <p><span className="lc-mention">@Admin</span> {admin.problems.length} things need fixing.</p>
          {admin.problems.map((p) => (
            <Embed key={p.title} tone="red" title={p.title}>
              <p className="lc-desc">{p.what}</p>
              <div className="lc-acts"><button type="button" className="lc-b danger small">{p.fix}</button></div>
            </Embed>
          ))}
        </Msg>
        <Msg from="Arrmy" time="Today at 14:25">
          <p>Downloading now.</p>
          {admin.downloads.map((d) => (
            <Embed key={d.title} tone="blue" title={d.title}>
              <div className="lc-fields">
                <span className="lc-fld"><small>Speed</small>{d.speedMbs} MB/s</span>
                <span className="lc-fld"><small>Time left</small>{d.eta}</span>
                <span className="lc-fld"><small>Seeds</small>{d.seeds}</span>
              </div>
              <div className="lc-acts"><Progress value={d.progress} tone="blue" /></div>
            </Embed>
          ))}
        </Msg>
        <Msg from="Arrmy" time="Today at 14:30">
          <p>{down.length === 0 ? 'All services are up.' : `${down.map((s) => s.name).join(', ')} is not answering.`}</p>
          <Embed tone={down.length === 0 ? 'green' : 'red'} title="Services">
            <div className="lc-svc">
              {admin.services.map((s) => <span key={s.name}><i className={s.ok ? 'lc-dot' : 'lc-dot down'} />{s.name}<small>{s.version}</small></span>)}
            </div>
          </Embed>
        </Msg>
      </div>
      <Compose channel="admin" placeholder="Type /search or /fix, or just ask Arrmy…" />
    </>
  )
}
