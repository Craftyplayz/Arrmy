import type { Metadata } from 'next'
import { settings } from '../../data'

export const metadata: Metadata = { title: 'Calendar · Settings' }

const SECTIONS: [id: string, label: string][] = [['limits', 'Size limits'], ['quality', 'Quality'], ['discord', 'Discord'], ['plex', 'Plex'], ['public', 'Public address'], ['reminders', 'Reminders']]
const QUALITIES = ['Any', 'HD-720p', 'HD-1080p', 'Ultra-HD']

export default function CalendarSettings() {
  const { limits, quality, discord, plex, publicUrl } = settings
  return (
    <>
      <div className="lc-toolbar">
        <h1>Settings</h1>
        <p>Limits, quality and where Arrmy talks to.</p>
      </div>
      <div className="lc-settings">
        <nav className="lc-setnav" aria-label="Settings sections">
          {SECTIONS.map(([id, label], i) => <a key={id} href={`#${id}`} className={i === 0 ? 'is-on' : undefined}>{label}</a>)}
        </nav>
        <div className="lc-setpanel">
          <section id="limits">
            <h2>Size limits</h2>
            <p className="lc-help">Releases bigger than this are skipped, so one Request can&apos;t fill a disk.</p>
            <div className="lc-fields">
              <label className="lc-field">Movie<input defaultValue={limits.movieGb} /><small>GB per Movie</small></label>
              <label className="lc-field">TV Show<input defaultValue={limits.episodeGbPerHour} /><small>GB per hour of episode</small></label>
              <label className="lc-field">Audiobook<input defaultValue={limits.audiobookMb} /><small>MB per Audiobook</small></label>
            </div>
          </section>
          <section id="quality">
            <h2>Quality</h2>
            <p className="lc-help">The profile Radarr and Sonarr aim for. Higher is bigger.</p>
            <div className="lc-fields">
              <label className="lc-field">Movies<select defaultValue={quality.movies}>{QUALITIES.map((q) => <option key={q}>{q}</option>)}</select></label>
              <label className="lc-field">TV Shows<select defaultValue={quality.tv}>{QUALITIES.map((q) => <option key={q}>{q}</option>)}</select></label>
              <label className="lc-field">Anime<select defaultValue={quality.anime}>{QUALITIES.map((q) => <option key={q}>{q}</option>)}</select></label>
            </div>
          </section>
          <section id="discord">
            <h2>Discord</h2>
            <p className="lc-help">Requesters can ask the bot in Discord, and it posts when something becomes Available.</p>
            <label className="lc-toggle"><input type="checkbox" defaultChecked={discord.enabled} /><i />Post to Discord</label>
            <div className="lc-fields">
              <label className="lc-field">Server<input defaultValue={discord.server} /></label>
              <label className="lc-field">Channel<input defaultValue={discord.channel} /><small>Where Available and Stuck notices go</small></label>
            </div>
          </section>
          <section id="plex">
            <h2>Plex</h2>
            <p className="lc-help">Requesters sign in with Plex. Only these libraries are checked for what&apos;s already there.</p>
            <div className="lc-fields">
              <label className="lc-field">Server<input defaultValue={plex.server} /></label>
              <div className="lc-field">Libraries<div className="lc-libs">{plex.libraries.map((l) => <span key={l} className="lc-chip is-on">{l}</span>)}</div></div>
            </div>
          </section>
          <section id="public">
            <h2>Public address</h2>
            <p className="lc-help">Links in Discord use this address, never the LAN one.</p>
            <label className="lc-field">Address<input defaultValue={publicUrl} /></label>
          </section>
          <section id="reminders">
            <h2>Reminders</h2>
            <p className="lc-help">Like a calendar reminder: tell me when a Request becomes Available.</p>
            <label className="lc-check"><input type="checkbox" defaultChecked />Discord</label>
            <label className="lc-check"><input type="checkbox" />Email</label>
            <label className="lc-check"><input type="checkbox" defaultChecked />Remind the Admin about Stuck Requests after 3 days</label>
          </section>
          <div className="lc-save">
            <button type="button" className="lc-btn primary">Save</button>
            <span>Nothing changes until you save.</span>
          </div>
        </div>
      </div>
    </>
  )
}
