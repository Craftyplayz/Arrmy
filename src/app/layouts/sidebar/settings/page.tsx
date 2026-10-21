import type { Metadata } from 'next'
import { settings } from '../../data'

export const metadata: Metadata = { title: 'Sidebar · Settings' }

const SECTIONS: [id: string, label: string][] = [
  ['limits', 'Size Limits'],
  ['quality', 'Quality'],
  ['discord', 'Discord'],
  ['plex', 'Plex'],
  ['public', 'Public address'],
]
const QUALITIES = ['Any', 'HD-720p', 'HD-1080p', 'Ultra-HD']

export default function SettingsPage() {
  const { limits, quality, discord, plex, publicUrl } = settings
  return (
    <>
      <div className="head">
        <h1>Settings</h1>
        <span className="sub">Size Limits apply to everyone's Requests</span>
      </div>

      <div className="settings">
        <nav className="subnav" aria-label="Settings sections">
          {SECTIONS.map(([id, label], i) => <a key={id} href={`#${id}`} className={i === 0 ? 'on' : undefined}>{label}</a>)}
        </nav>

        <div className="forms">
          <section id="limits" className="panel">
            <h2>Size Limits</h2>
            <div className="form">
              <label>Movie, in GB
                <input className="field" type="number" defaultValue={limits.movieGb} />
                <small>The biggest movie file Radarr may download. Leave empty for no limit.</small>
              </label>
              <label>Episode, in GB per hour
                <input className="field" type="number" defaultValue={limits.episodeGbPerHour} />
                <small>For a 1-hour episode; a 30-minute episode gets half. Season packs are judged per episode.</small>
              </label>
              <label>Audiobook, in MB
                <input className="field" type="number" defaultValue={limits.audiobookMb} />
                <small>Per book, however many files it comes in.</small>
              </label>
              <div className="actions"><button type="button" className="b p">Save limits</button></div>
            </div>
          </section>

          <section id="quality" className="panel">
            <h2>Quality</h2>
            <div className="form cols3">
              <label>Movies
                <select className="field" defaultValue={quality.movies}>{QUALITIES.map((q) => <option key={q}>{q}</option>)}</select>
                <small>Radarr profile for new Requests.</small>
              </label>
              <label>TV Shows
                <select className="field" defaultValue={quality.tv}>{QUALITIES.map((q) => <option key={q}>{q}</option>)}</select>
                <small>Sonarr profile for new Requests.</small>
              </label>
              <label>Anime
                <select className="field" defaultValue={quality.anime}>{QUALITIES.map((q) => <option key={q}>{q}</option>)}</select>
                <small>Used when TheTVDB marks a show as anime.</small>
              </label>
              <div className="actions"><button type="button" className="b p">Save quality</button></div>
            </div>
          </section>

          <section id="discord" className="panel">
            <h2>Discord</h2>
            <div className="form">
              <label className="check"><input type="checkbox" defaultChecked={discord.enabled} /> Post when a Request becomes Available</label>
              <label>Server
                <input className="field" defaultValue={discord.server} />
                <small>The server the Arrmy bot has joined.</small>
              </label>
              <label>Channel
                <input className="field" defaultValue={discord.channel} />
                <small>Where the bot posts. Problems go to #problems.</small>
              </label>
              <div className="actions"><button type="button" className="b p">Save Discord</button></div>
            </div>
          </section>

          <section id="plex" className="panel">
            <h2>Plex</h2>
            <div className="form">
              <label>Server
                <input className="field" defaultValue={plex.server} />
                <small>Requesters sign in with a Plex account this server is shared with.</small>
              </label>
              <fieldset>
                <legend>Libraries to check for Available titles</legend>
                {plex.libraries.map((l) => <label key={l} className="check"><input type="checkbox" defaultChecked /> {l}</label>)}
              </fieldset>
              <div className="actions"><button type="button" className="b p">Save Plex</button></div>
            </div>
          </section>

          <section id="public" className="panel">
            <h2>Public address</h2>
            <div className="form">
              <label>Address
                <input className="field" type="url" defaultValue={publicUrl} />
                <small>Links in Discord open here. Never a LAN address.</small>
              </label>
              <div className="actions"><button type="button" className="b p">Save address</button></div>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
