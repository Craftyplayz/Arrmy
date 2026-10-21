import type { Metadata } from 'next'
import { admin, poster, requests } from '../../data'
import { Chip, Pal, Row } from '../bits'

export const metadata: Metadata = { title: 'Command palette · Requests' }

const count = (s: string) => requests.filter((r) => r.status === s).length
const FILTERS: [label: string, n: number][] = [['All', requests.length], ['Downloading', count('Downloading')], ['Stuck', count('Stuck')], ['Available', count('Available')]]

// Severance: mid-download, so the footer has something to say.
const hot = requests[1]

export default function PaletteRequests() {
  return (
    <Pal mode="> requests" placeholder="Filter Requests…" footer={<><b>{hot.status} {hot.progress}%</b> · {hot.sizeGb} GB · {admin.downloads[0].eta} left <span className="sp" /> <kbd>⌘⇧R</kbd> Remove</>}>
      <div className="pal-filters">
        {FILTERS.map(([label, n], i) => <span key={label} className={i === 0 ? 'on' : ''}>{label}<b>{n}</b></span>)}
      </div>
      {requests.map((r) => (
        <Row key={r.id} hot={r === hot} icon={<i className="pal-dot" style={poster(r.title.hue)} />} title={r.title.title} sub={`${r.detail} · ${r.requestedBy} · ${r.requestedAgo}`} right={<Chip s={r.status} />}>
          {(r.status === 'Downloading' || r.status === 'Importing') && (
            <span className={r.status === 'Importing' ? 'pal-bar gold' : 'pal-bar'}><i style={{ width: `${r.progress}%` }} /></span>
          )}
        </Row>
      ))}
    </Pal>
  )
}
