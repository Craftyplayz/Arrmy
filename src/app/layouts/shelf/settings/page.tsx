import type { Metadata } from 'next'
import { settings } from '../../data'

export const metadata: Metadata = { title: 'Shelf · Settings' }

const { limits, quality, discord, plex, publicUrl } = settings

export default function ShelfSettings() {
  return (
    <>
      <div className="desk-head">
        <div>
          <h1>Librarian's desk</h1>
          <p className="lede">The rules the shelves run by. Change a card and stamp it to save.</p>
        </div>
        <button type="button" className="stamp">Save</button>
      </div>
      <div className="desk">
        <Card title="Size limits">
          <Field label="Movie (GB)" value={limits.movieGb} help="Releases bigger than this are skipped." />
          <Field label="Episode (GB per hour)" value={limits.episodeGbPerHour} help="Scaled by the episode's runtime." />
          <Field label="Audiobook (MB)" value={limits.audiobookMb} help="Audiobooks are small; this catches mislabelled video." />
        </Card>
        <Card title="Quality">
          <Field label="Movies" value={quality.movies} help="The Radarr quality profile new Requests use." />
          <Field label="TV Shows" value={quality.tv} help="The Sonarr profile for new shows." />
          <Field label="Anime" value={quality.anime} help="Anime is rarer, so take any quality." />
        </Card>
        <Card title="Discord">
          <label className="check"><input type="checkbox" defaultChecked={discord.enabled} /> Post to Discord</label>
          <Field label="Server" value={discord.server} />
          <Field label="Channel" value={discord.channel} help="New Requests, Available titles and problems go here." />
        </Card>
        <Card title="Plex">
          <Field label="Server" value={plex.server} help="Requesters sign in with their Plex account." />
          <label>Libraries</label>
          <div className="chips">{plex.libraries.map((l) => <span key={l} className="chip">{l}</span>)}</div>
        </Card>
        <Card title="Public address">
          <Field label="Address" value={publicUrl} help="Used in Discord links so they open from anywhere, never a LAN address." />
        </Card>
      </div>
    </>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="index"><i className="pin" /><h2>{title}</h2>{children}</section>
}

function Field({ label, value, help }: { label: string; value: string | number; help?: string }) {
  return (
    <>
      <label>{label}<input className="in" defaultValue={value} /></label>
      {help && <p className="help">{help}</p>}
    </>
  )
}
