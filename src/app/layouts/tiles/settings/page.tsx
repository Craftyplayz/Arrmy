import type { Metadata } from 'next'
import { settings } from '../../data'

export const metadata: Metadata = { title: 'Tiles · Settings' }

function Field({ label, value, hint, type = 'text' }: { label: string; value: string | number; hint?: string; type?: string }) {
  return (
    <label className="t-lab">{label}<input className="t-field" type={type} defaultValue={value} />{hint && <small>{hint}</small>}</label>
  )
}

function Toggle({ label, on, hint }: { label: string; on: boolean; hint?: string }) {
  return (
    <label className="t-toggle"><span>{label}{hint && <small>{hint}</small>}</span><input type="checkbox" defaultChecked={on} readOnly /></label>
  )
}

export default function TilesSettings() {
  const { limits, quality, discord, plex, publicUrl } = settings
  return (
    <>
      <h1 className="t-page">Settings</h1>
      <div className="t-settings">
        <section className="tile">
          <h2 className="t-h">Size limits</h2>
          <div className="t-form">
            <div className="t-cols">
              <Field label="Movie (GB)" value={limits.movieGb} type="number" />
              <Field label="Episode (GB per hour)" value={limits.episodeGbPerHour} type="number" />
            </div>
            <Field label="Audiobook (MB)" value={limits.audiobookMb} type="number" hint="Bigger releases are skipped so one Request can't fill a disk." />
          </div>
        </section>

        <section className="tile">
          <h2 className="t-h">Quality</h2>
          <div className="t-form">
            <div className="t-cols">
              <Field label="Movies" value={quality.movies} />
              <Field label="TV Shows" value={quality.tv} />
            </div>
            <Field label="Anime" value={quality.anime} hint="The quality profile Radarr and Sonarr grab for new Requests." />
          </div>
        </section>

        <section className="tile">
          <h2 className="t-h">Discord</h2>
          <div className="t-form">
            <Toggle label="Post to Discord" on={discord.enabled} hint="New Requests, Available titles and problems" />
            <div className="t-cols">
              <Field label="Server" value={discord.server} />
              <Field label="Channel" value={discord.channel} />
            </div>
          </div>
        </section>

        <section className="tile">
          <h2 className="t-h">Plex</h2>
          <div className="t-form">
            <Field label="Server" value={plex.server} />
            <p className="t-sub">Libraries Requesters can pick from</p>
            {plex.libraries.map(l => <Toggle key={l} label={l} on />)}
          </div>
        </section>

        <section className="tile">
          <h2 className="t-h">Public address</h2>
          <div className="t-form">
            <Field label="Address" value={publicUrl} type="url" hint="Every link the Discord bot posts starts with this. Never a LAN address." />
          </div>
        </section>

        <section className="tile t-save">
          <p>Changes apply to new Requests straight away.</p>
          <button type="button" className="t-btn primary">Save settings</button>
        </section>
      </div>
    </>
  )
}
