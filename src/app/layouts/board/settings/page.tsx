import type { Metadata } from 'next'
import { settings } from '../../data'

export const metadata: Metadata = { title: 'Board · Settings' }

const QUALITIES = ['HD-1080p', 'Ultra-HD', 'HD-720p', 'Any']

export default function BoardSettings() {
  const { limits, quality, discord, plex, publicUrl } = settings
  return (
    <>
      <div className="lb-toolbar">
        <h1>Settings</h1>
        <span className="lb-hint">Each card saves on its own · <kbd>⌘</kbd><kbd>S</kbd> saves the card you are in</span>
      </div>

      <div className="lb-settings">
        <Card title="Size Limits" note="Applies to everyone's Requests. Leave a box empty for no limit." save="Save limits">
          <div className="lb-cols">
            <label>Movie, in GB<input className="lb-field" type="number" defaultValue={limits.movieGb} /></label>
            <label>Episode, in GB per hour<input className="lb-field" type="number" defaultValue={limits.episodeGbPerHour} /></label>
            <label>Audiobook, in MB<input className="lb-field" type="number" defaultValue={limits.audiobookMb} /></label>
          </div>
        </Card>

        <Card title="Quality" note="The profile each Service downloads with." save="Save quality">
          <div className="lb-cols">
            <label>Movies<Select value={quality.movies} /></label>
            <label>TV Shows<Select value={quality.tv} /></label>
            <label>Anime<Select value={quality.anime} /></label>
          </div>
        </Card>

        <Card title="Discord" note="Where the bot posts when a Request becomes Available or needs fixing." save="Save Discord">
          <label className="check"><input type="checkbox" defaultChecked={discord.enabled} />Post to Discord</label>
          <div className="lb-cols">
            <label>Server<input className="lb-field" defaultValue={discord.server} /></label>
            <label>Channel<input className="lb-field" defaultValue={discord.channel} /></label>
          </div>
        </Card>

        <Card title="Plex" note="The Media Server Requesters watch on, and which libraries Arrmy fills." save="Save Plex">
          <label>Server<input className="lb-field" defaultValue={plex.server} /></label>
          <div className="lb-cols">
            {plex.libraries.map((l) => <label key={l} className="check"><input type="checkbox" defaultChecked />{l}</label>)}
          </div>
        </Card>

        <Card title="Public address" note="Links in Discord and emails start with this, never the LAN address." save="Save address">
          <label>Address<input className="lb-field" type="url" defaultValue={publicUrl} /></label>
        </Card>
      </div>
    </>
  )
}

function Select({ value }: { value: string }) {
  return <select className="lb-field" defaultValue={value}>{QUALITIES.map((q) => <option key={q}>{q}</option>)}</select>
}

function Card({ title, note, save, children }: { title: string; note: string; save: string; children: React.ReactNode }) {
  return (
    <section className="lb-panel">
      <div className="lb-panel-head"><h2>{title}</h2><p>{note}</p></div>
      {children}
      <footer>
        <button type="button" className="lb-btn primary">{save}</button>
        <span className="lb-hint">Saved 3 days ago</span>
      </footer>
    </section>
  )
}
