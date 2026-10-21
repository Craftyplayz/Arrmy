import type { Metadata } from 'next'
import { settings } from '../../data'

export const metadata: Metadata = { title: 'Phone app · Settings' }

// iOS-style coloured squares with a glyph, one per top-level row
const ICONS: Record<string, [colour: string, path: string]> = {
  limits: ['#e5484d', 'M4 7h16M4 12h10M4 17h7'],
  quality: ['#3b82f6', 'M3 6h18v12H3zM8 21h8'],
  discord: ['#5865f2', 'M5 8a9 9 0 0 1 14 0l1 9-4 2-1-2H9l-1 2-4-2z'],
  plex: ['#d4a52a', 'M6 4h5l7 8-7 8H6l7-8z'],
  address: ['#30a46c', 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18'],
}

const { limits, quality, discord, plex, publicUrl } = settings
const host = publicUrl.replace(/^https?:\/\//, '')

// A div, not a form: pressing Enter in a mockup field must not reload the page.
export default function Settings() {
  return (
    <>
      <h1 className="lm-title">Settings</h1>

      <div className="lm-group">
        <Row icon="limits" label="Size Limits" value={`${limits.movieGb} GB`} />
        <Row icon="quality" label="Quality" value={quality.movies} />
        <Row icon="discord" label="Discord" value={discord.enabled ? 'On' : 'Off'} />
        <Row icon="plex" label="Plex" value={plex.server} />
        <Row icon="address" label="Public address" value={host} />
      </div>

      <h2 className="lm-h2">Size Limits</h2>
      <div className="lm-group">
        <Field label="Movie" value={limits.movieGb} unit="GB" />
        <Field label="TV episode, per hour" value={limits.episodeGbPerHour} unit="GB" />
        <Field label="Audiobook" value={limits.audiobookMb} unit="MB" />
      </div>
      <p className="lm-foot">A Request over its limit is refused before anything downloads.</p>

      <h2 className="lm-h2">Quality</h2>
      <div className="lm-group">
        <Row label="Movies" value={quality.movies} />
        <Row label="TV Shows" value={quality.tv} />
        <Row label="Anime" value={quality.anime} />
      </div>

      <h2 className="lm-h2">Discord</h2>
      <div className="lm-group">
        <Toggle label="Post to Discord" on={discord.enabled} />
        <Row label="Server" value={discord.server} />
        <Row label="Channel" value={discord.channel} />
      </div>
      <p className="lm-foot">Requesters hear in {discord.channel} when something becomes Available.</p>

      <h2 className="lm-h2">Plex</h2>
      <div className="lm-group">
        <Row label="Server" value={plex.server} />
        {plex.libraries.map((l) => <Toggle key={l} label={l} on />)}
      </div>

      <h2 className="lm-h2">Public address</h2>
      <div className="lm-group">
        <label className="lm-cell">
          <input className="lm-input" style={{ width: '100%', textAlign: 'left' }} type="url" defaultValue={publicUrl} />
        </label>
      </div>
      <p className="lm-foot">Links in Discord use this address, never the LAN one.</p>

      <button type="button" className="lm-btn wide">Save</button>
    </>
  )
}

function Row({ icon, label, value }: { icon?: string; label: string; value: string }) {
  const ic = icon && ICONS[icon]
  return (
    <div className="lm-cell">
      {ic && (
        <span className="lm-icon" style={{ background: ic[0] }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ic[1]} /></svg>
        </span>
      )}
      <span>{label}</span>
      <span className="lm-val">{value}</span>
      <span className="lm-chev" aria-hidden="true">›</span>
    </div>
  )
}

function Field({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <label className="lm-cell">
      <span>{label}</span>
      <input className="lm-input" type="number" defaultValue={value} />
      <span className="lm-unit">{unit}</span>
    </label>
  )
}

function Toggle({ label, on }: { label: string; on: boolean }) {
  return (
    <label className="lm-cell">
      <span>{label}</span>
      <input className="lm-toggle" type="checkbox" defaultChecked={on} readOnly />
    </label>
  )
}
