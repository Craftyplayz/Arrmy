import type { Metadata } from 'next'
import { settings } from '../../data'

export const metadata: Metadata = { title: 'Search first · Settings' }

const QUALITIES = ['Any', 'HD-720p', 'HD-1080p', 'Ultra-HD']

// A div, not a form: pressing Enter in a mockup field must not reload the page.
export default function Settings() {
  const { limits, quality, discord, plex, publicUrl } = settings
  return (
    <div className="ls-col">
      <h1 className="ls-h1">Settings</h1>
      <p className="ls-sum">How big a Request may be, what quality to fetch, and where Arrmy talks.</p>

      <section className="ls-sec">
        <h2>Size limits</h2>
        <p className="ls-lede">A Request over its limit is refused before anything downloads.</p>
        <label className="ls-field">
          <span>Movie, GB</span>
          <input className="ls-input short" type="number" defaultValue={limits.movieGb} />
          <small>Most 1080p films are 10 to 30 GB. 4K ones can pass 60 GB.</small>
        </label>
        <label className="ls-field">
          <span>TV episode, GB per hour</span>
          <input className="ls-input short" type="number" defaultValue={limits.episodeGbPerHour} />
          <small>A 45-minute episode may use three quarters of this.</small>
        </label>
        <label className="ls-field">
          <span>Audiobook, MB</span>
          <input className="ls-input short" type="number" defaultValue={limits.audiobookMb} />
          <small>Anything bigger is usually a lossless rip, which Plex does not need.</small>
        </label>
      </section>

      <section className="ls-sec">
        <h2>Quality</h2>
        <p className="ls-lede">The profile Radarr and Sonarr look for. Lower is faster to find.</p>
        {([['Movies', quality.movies], ['TV Shows', quality.tv], ['Anime', quality.anime]] as const).map(([label, value]) => (
          <label key={label} className="ls-field">
            <span>{label}</span>
            <select className="ls-input" defaultValue={value}>{QUALITIES.map((q) => <option key={q}>{q}</option>)}</select>
            <small>{label === 'Anime' ? 'Anime releases are rarer, so Any finds more.' : 'HD-1080p suits most TVs and keeps the disk from filling.'}</small>
          </label>
        ))}
      </section>

      <section className="ls-sec">
        <h2>Discord</h2>
        <p className="ls-lede">Arrmy posts when a Request becomes Available and takes Requests from the channel.</p>
        <label className="ls-check"><input type="checkbox" defaultChecked={discord.enabled} /> Post to Discord</label>
        <label className="ls-field">
          <span>Server</span>
          <input className="ls-input" type="text" defaultValue={discord.server} />
          <small>The bot must already be invited to it.</small>
        </label>
        <label className="ls-field">
          <span>Channel</span>
          <input className="ls-input short" type="text" defaultValue={discord.channel} />
          <small>Where the "now Available" posts go.</small>
        </label>
      </section>

      <section className="ls-sec">
        <h2>Plex</h2>
        <p className="ls-lede">Which Plex server Requesters sign in with, and which libraries count as Available.</p>
        <label className="ls-field">
          <span>Server</span>
          <input className="ls-input" type="text" defaultValue={plex.server} />
          <small>Anyone who can see this server can sign in to Arrmy.</small>
        </label>
        <div className="ls-field">
          <span>Libraries</span>
          <div className="ls-checks">
            {plex.libraries.map((l) => <label key={l} className="ls-check"><input type="checkbox" defaultChecked /> {l}</label>)}
          </div>
          <small>A title in a ticked library shows as Available in search.</small>
        </div>
      </section>

      <section className="ls-sec">
        <h2>Public address</h2>
        <p className="ls-lede">Where Arrmy can be reached from outside the house.</p>
        <label className="ls-field">
          <span>Address</span>
          <input className="ls-input" type="url" defaultValue={publicUrl} />
          <small>Every link the Discord bot posts uses this, never the LAN address.</small>
        </label>
      </section>

      <div className="ls-save">
        <span className="ls-sub">Nothing changes until you press Save.</span>
        <button type="button" className="ls-btn">Save</button>
      </div>
    </div>
  )
}
