import type { Metadata } from 'next'
import { settings } from '../../data'
import { Hints } from '../bits'

export const metadata: Metadata = { title: 'Terminal · Settings' }

const { limits, quality, discord, plex, publicUrl } = settings
const SECTIONS: [section: string, rows: [key: string, value: string][]][] = [
  ['limits', [['movie_gb', String(limits.movieGb)], ['episode_gb_per_hour', String(limits.episodeGbPerHour)], ['audiobook_mb', String(limits.audiobookMb)]]],
  ['quality', [['movies', quality.movies], ['tv', quality.tv], ['anime', quality.anime]]],
  ['discord', [['enabled', String(discord.enabled)], ['server', discord.server], ['channel', discord.channel]]],
  ['plex', [['server', plex.server], ['libraries', plex.libraries.join(', ')]]],
  ['public', [['url', publicUrl]]],
]

export default function Settings() {
  return (
    <>
      <p className="lt-prompt"><b>&gt;</b> edit: <span className="lt-dim">/config/arrmy.conf</span></p>
      <div className="lt-conf">
        <p className="lt-dim"># arrmy.conf — the Admin&apos;s settings. Change a value, then :w to save.</p>
        {SECTIONS.map(([section, rows]) => (
          <section key={section}>
            <h2 className="lt-sec">[{section}]</h2>
            {rows.map(([k, v]) => (
              <label key={k} className="lt-kv">
                <span className="lt-k">{k}</span> = <input className="lt-in" defaultValue={v} size={Math.max(4, v.length + 1)} />
              </label>
            ))}
          </section>
        ))}
      </div>
      <Hints keys={[[':w', 'save'], [':q', 'discard'], ['[j/k]', 'move'], ['[i]', 'edit']]} />
    </>
  )
}
