import type { Metadata } from 'next'
import { poster, recentlyAdded, requests, searchResults, trending } from '../data'
import { Chip, Group, Ico, Pal, Row } from './bits'

export const metadata: Metadata = { title: 'Command palette · Home' }

const COMMANDS: [icon: string, label: string, href: string, key: string][] = [
  ['list', 'Show my Requests', '/layouts/palette/requests', '⌘2'],
  ['shield', 'Open Admin', '/layouts/palette/admin', '⌘3'],
  ['gear', 'Settings', '/layouts/palette/settings', '⌘4'],
  ['out', 'Sign out', '/layouts/palette', '⌘⇧Q'],
]

const status = (id: number) => requests.find((r) => r.title.id === id)?.status

export default function PaletteHome() {
  return (
    <>
      <div className="pal-wall" aria-hidden="true">
        {[...trending, ...trending].map((t, i) => <i key={i} style={poster(t.hue)} />)}
      </div>
      <Pal value="the" footer={<><kbd>↑↓</kbd> Move <kbd>↵</kbd> Request <kbd>⌘1–5</kbd> Tabs <span className="sp" /> <kbd>esc</kbd> Close</>}>
        <Group title="Titles">
          {searchResults.map((t, i) => {
            const s = status(t.id)
            return (
              <Row key={t.id} hot={i === 0} icon={<i className="pal-poster" style={poster(t.hue)} />} title={t.title} sub={`${t.year} · ${t.type}`} right={s ? <Chip s={s} /> : <><kbd>↵</kbd> Request</>} />
            )
          })}
        </Group>
        <Group title="Recent">
          {recentlyAdded.map((t) => (
            <Row key={t.id} icon={<i className="pal-poster" style={poster(t.hue)} />} title={t.title} sub={`${t.year} · ${t.type}`} right={<><Ico n="play" /> Open in Plex</>} />
          ))}
        </Group>
        <Group title="Commands">
          {COMMANDS.map(([icon, label, href, key]) => <Row key={label} href={href} icon={<Ico n={icon} />} title={label} right={<kbd>{key}</kbd>} />)}
        </Group>
      </Pal>
    </>
  )
}
