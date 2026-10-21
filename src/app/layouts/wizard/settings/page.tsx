import type { Metadata } from 'next'
import { settings } from '../../data'

export const metadata: Metadata = { title: 'One thing at a time · Settings' }

const { limits, quality, discord, plex, publicUrl } = settings
const QUALITIES = ['Any', 'HD-720p', 'HD-1080p', 'Ultra-HD']

/** Each section's cards: the question, its field, and one line on why it matters. */
const GROUPS: [section: string, cards: [question: string, field: React.ReactNode, why: string][]][] = [
  ['Size limits', [
    ['How big may a movie be?', <Num value={limits.movieGb} unit="GB" />, 'Bigger releases are skipped, so a 4K remux never fills the disk.'],
    ['How big may an episode be, per hour?', <Num value={limits.episodeGbPerHour} unit="GB" />, 'A one-hour episode may be this big; a half-hour one, half of it.'],
    ['How big may an audiobook be?', <Num value={limits.audiobookMb} unit="MB" />, 'Most audiobooks are well under this.'],
  ]],
  ['Quality', [
    ['What quality for Movies?', <Pick value={quality.movies} />, 'Radarr looks for this and settles for the nearest below it.'],
    ['What quality for TV Shows?', <Pick value={quality.tv} />, 'Sonarr does the same for episodes.'],
    ['What quality for anime?', <Pick value={quality.anime} />, 'Anime releases are rarer, so Any is usually right.'],
  ]],
  ['Discord', [
    ['Tell people on Discord?', <label className="wz-check"><input type="checkbox" defaultChecked={discord.enabled} /> Yes, post when a Request changes</label>, 'Requesters get a message when their title is Available or Stuck.'],
    ['Which server?', <input className="wz-field" defaultValue={discord.server} />, 'The bot must already be in it.'],
    ['Which channel?', <input className="wz-field" defaultValue={discord.channel} />, 'Where the bot posts. Requesters are mentioned by name.'],
  ]],
  ['Plex', [
    ['Which Plex server?', <input className="wz-field" defaultValue={plex.server} />, 'Only people this server is shared with can sign in.'],
    ['Which libraries?', <div className="wz-pills">{plex.libraries.map((l) => <button key={l} type="button" className="wz-pill on">{l}</button>)}</div>, 'New files land in these, and "Open in Plex" points at them.'],
  ]],
  ['Public address', [
    ['Where does the family reach Arrmy?', <input className="wz-field wide" defaultValue={publicUrl} />, 'Links in Discord messages use this address, never the LAN one.'],
  ]],
]

export default function WizardSettings() {
  return (
    <div className="wz-page">
      <h1 className="wz-title">Settings</h1>
      <p className="wz-lede">One thing per card. Change it, then Save.</p>
      {GROUPS.map(([section, cards]) => (
        <section key={section}>
          <h2 className="wz-h">{section}</h2>
          {cards.map(([question, field, why]) => (
            <div key={question} className="wz-set">
              <label className="wz-ask">{question}</label>
              {field}
              <p className="wz-set-foot"><span>{why}</span><button type="button" className="wz-save">Save</button></p>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

function Num({ value, unit }: { value: number; unit: string }) {
  return <p className="wz-field-row"><input className="wz-field num" type="number" defaultValue={value} /><span className="wz-unit">{unit}</span></p>
}

function Pick({ value }: { value: string }) {
  return <select className="wz-field" defaultValue={value}>{QUALITIES.map((q) => <option key={q}>{q}</option>)}</select>
}
