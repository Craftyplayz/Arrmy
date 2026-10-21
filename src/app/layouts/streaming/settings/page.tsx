import type { Metadata } from 'next'
import { settings } from '../../data'

export const metadata: Metadata = { title: 'Streaming · Settings' }

const QUALITY = ['Any', 'HD-720p', 'HD-1080p', 'Ultra-HD']

export default function StreamingSettings() {
  const { limits, quality, discord, plex, publicUrl } = settings
  return (
    <div className="st-page">
      <h1>Settings</h1>
      <p className="st-lede">Size Limits and quality apply to everyone's Requests.</p>
      <div className="st-settings">
        <section className="st-group">
          <h2>Size Limits</h2>
          <Row label="Movie" hint="The biggest movie file Radarr may download."><Num value={limits.movieGb} unit="GB" /></Row>
          <Row label="Episode, per hour" hint="A 30-minute episode gets half. Season packs are judged per episode."><Num value={limits.episodeGbPerHour} unit="GB" /></Row>
          <Row label="Audiobook" hint="Per book, however many files."><Num value={limits.audiobookMb} unit="MB" /></Row>
        </section>
        <section className="st-group">
          <h2>Quality</h2>
          <Row label="Movies"><Pick value={quality.movies} /></Row>
          <Row label="TV Shows"><Pick value={quality.tv} /></Row>
          <Row label="Anime" hint="Sonarr's anime profile."><Pick value={quality.anime} /></Row>
        </section>
        <section className="st-group">
          <h2>Discord</h2>
          <Row label="Post to Discord" hint="New Requests, and when they become Available."><Toggle on={discord.enabled} /></Row>
          <Row label="Server"><input className="st-field" defaultValue={discord.server} /></Row>
          <Row label="Channel"><input className="st-field" defaultValue={discord.channel} /></Row>
        </section>
        <section className="st-group">
          <h2>Plex</h2>
          <Row label="Server"><input className="st-field" defaultValue={plex.server} /></Row>
          <Row label="Libraries" hint="Where Available titles turn up."><span className="st-tags">{plex.libraries.map((l) => <span key={l} className="st-tag">{l}</span>)}</span></Row>
        </section>
        <section className="st-group">
          <h2>Public address</h2>
          <Row label="Address" hint="Used in Discord links. Never a LAN IP."><input className="st-field wide" defaultValue={publicUrl} /></Row>
        </section>
        <div className="st-save">
          <button type="button" className="st-btn">Discard</button>
          <button type="button" className="st-btn primary">Save changes</button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="st-setting"><span><b>{label}</b>{hint && <small>{hint}</small>}</span>{children}</label>
}
const Num = ({ value, unit }: { value: number; unit: string }) => <span className="st-unit"><input className="st-field num" type="number" defaultValue={value} />{unit}</span>
const Pick = ({ value }: { value: string }) => <select className="st-field" defaultValue={value}>{QUALITY.map((q) => <option key={q}>{q}</option>)}</select>
const Toggle = ({ on }: { on: boolean }) => <span className="st-toggle"><input type="checkbox" defaultChecked={on} /><i /></span>
