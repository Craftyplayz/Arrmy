import type { Metadata } from 'next'
import { settings } from '../../data'

export const metadata: Metadata = { title: 'Magazine · Settings' }

const QUALITIES = ['Any', 'HD-720p', 'HD-1080p', 'Ultra-HD']

export default function MagazineSettings() {
  const { limits, quality, discord, plex, publicUrl } = settings
  return (
    <>
      <h1 className="lm-title">Masthead &amp; policies</h1>
      <p className="lm-lede">How big a Request may be, what quality to ask for, and where Arrmy announces itself.</p>

      <div className="lm-policies">
        <section className="lm-policy">
          <h2>Size limits</h2>
          <p>Anything bigger is refused at the point of Request, so one film cannot fill a disk.</p>
          <div className="lm-fields">
            <label>Movie, GB<input className="lm-field" defaultValue={limits.movieGb} /><small>Per film. 4K releases usually need 60 or more.</small></label>
            <label>Episode, GB per hour<input className="lm-field" defaultValue={limits.episodeGbPerHour} /><small>A 45-minute episode at 4 GB per hour may be up to 3 GB.</small></label>
            <label>Audiobook, MB<input className="lm-field" defaultValue={limits.audiobookMb} /><small>Most 16-hour books are under 500 MB.</small></label>
          </div>
        </section>

        <section className="lm-policy">
          <h2>Quality</h2>
          <p>The profile Radarr and Sonarr search for. A lower one is accepted if nothing better turns up.</p>
          <div className="lm-fields">
            <label>Movies<select className="lm-field" defaultValue={quality.movies}>{QUALITIES.map((q) => <option key={q}>{q}</option>)}</select><small>Applies to every new Movie Request.</small></label>
            <label>TV Shows<select className="lm-field" defaultValue={quality.tv}>{QUALITIES.map((q) => <option key={q}>{q}</option>)}</select><small>Season packs are preferred where they exist.</small></label>
            <label>Anime<select className="lm-field" defaultValue={quality.anime}>{QUALITIES.map((q) => <option key={q}>{q}</option>)}</select><small>Fansubs vary; Any gets a release sooner.</small></label>
          </div>
        </section>

        <section className="lm-policy">
          <h2>Discord</h2>
          <p>Where Arrmy posts when a Request becomes Available, and where the bot takes Requests.</p>
          <div className="lm-fields">
            <label className="lm-check"><input type="checkbox" defaultChecked={discord.enabled} />Post to Discord</label>
            <span />
            <label>Server<input className="lm-field" defaultValue={discord.server} /><small>The bot must already be invited there.</small></label>
            <label>Channel<input className="lm-field" defaultValue={discord.channel} /><small>Announcements and bot replies go here.</small></label>
          </div>
        </section>

        <section className="lm-policy">
          <h2>Plex</h2>
          <p>The server Requesters sign in with, and the libraries Arrmy watches for new arrivals.</p>
          <div className="lm-fields">
            <label>Server<input className="lm-field" defaultValue={plex.server} /><small>As it appears in the Plex app.</small></label>
            <label>Libraries<input className="lm-field" defaultValue={plex.libraries.join(', ')} /><small>Comma-separated; one per Media Type.</small></label>
          </div>
        </section>

        <section className="lm-policy">
          <h2>Public address</h2>
          <p>The address in Discord links and e-mails. Never the LAN address.</p>
          <div className="lm-fields">
            <label>Address<input className="lm-field" defaultValue={publicUrl} /><small>Including https://, no trailing slash.</small></label>
          </div>
        </section>

        <div className="lm-save">
          <button type="button" className="lm-btn">Save policies</button>
          <small>Last saved yesterday by Crafty.</small>
        </div>
      </div>
    </>
  )
}
