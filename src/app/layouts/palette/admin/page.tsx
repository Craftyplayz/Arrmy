import type { Metadata } from 'next'
import { admin } from '../../data'
import { Group, Ico, Pal, Row } from '../bits'

export const metadata: Metadata = { title: 'Command palette · Admin' }

const hot = admin.problems[0]
const HUES: Record<string, number> = { Crafty: 200, Sam: 30, Jo: 300, Alex: 140 }

export default function PaletteAdmin() {
  return (
    <Pal mode="> admin" placeholder="Filter…" footer={<><b>{hot.title}</b> · {hot.what} <span className="sp" /> <kbd>↵</kbd> {hot.fix} <kbd>⌘⇧R</kbd> Remove</>}>
      <Group title="Needs fixing">
        {admin.problems.map((p) => (
          <Row key={p.title} hot={p === hot} bad icon={<Ico n="alert" />} title={p.title} sub={p.what} right={<><kbd>↵</kbd> Fix</>} />
        ))}
      </Group>
      <Group title="Downloading">
        {admin.downloads.map((d) => (
          <Row key={d.title} icon={<Ico n="down" />} title={d.title} sub={`${d.speedMbs} MB/s · ${d.eta} left · ${d.seeds} seeds`} right={`${d.progress}%`}>
            <span className="pal-bar"><i style={{ width: `${d.progress}%` }} /></span>
          </Row>
        ))}
      </Group>
      <Group title="Disks">
        {admin.disks.map((d) => {
          const used = Math.round((d.usedTb / d.totalTb) * 100)
          return (
            <Row key={d.name} icon={<Ico n="disk" />} title={d.name} sub={`${used}% used`} right={<><span className={used > 90 ? 'pal-disk warn' : 'pal-disk'}><i style={{ width: `${used}%` }} /></span>{d.usedTb} / {d.totalTb} TB</>} />
          )
        })}
      </Group>
      <Group title="Services">
        {admin.services.map((s) => (
          <Row key={s.name} icon={<i className={s.ok ? 'pal-led' : 'pal-led off'} />} title={s.name} sub={s.version} right={s.ok ? 'Running' : <span className="bad">Not responding</span>} />
        ))}
      </Group>
      <Group title="Requesters">
        {admin.requesters.map((r) => (
          <Row key={r.name} icon={<i className="pal-av" style={{ background: `hsl(${HUES[r.name]} 55% 45%)` }}>{r.name[0]}</i>} title={r.name} sub={r.admin ? 'Admin' : 'Requester'} right={`${r.requests} Requests`} />
        ))}
      </Group>
    </Pal>
  )
}
