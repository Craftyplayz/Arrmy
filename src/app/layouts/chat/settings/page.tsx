import type { Metadata } from 'next'
import { settings } from '../../data'
import { Compose, Day, Embed, Head, Msg } from '../bits'

export const metadata: Metadata = { title: 'Chat feed · Settings' }

const s = settings
/** Each section is a slash command; its fields are shown the way a bot would echo them back. */
const SECTIONS: [name: string, cmd: string, fields: [label: string, value: string][]][] = [
  ['Size limits', '/settings limits', [['Movie', `${s.limits.movieGb} GB`], ['Episode', `${s.limits.episodeGbPerHour} GB per hour`], ['Audiobook', `${s.limits.audiobookMb} MB`]]],
  ['Quality', '/settings quality', [['Movies', s.quality.movies], ['TV Shows', s.quality.tv], ['Anime', s.quality.anime]]],
  ['Discord', '/settings discord', [['Bot', s.discord.enabled ? 'On' : 'Off'], ['Server', s.discord.server], ['Channel', s.discord.channel]]],
  ['Plex', '/settings plex', [['Server', s.plex.server], ['Libraries', s.plex.libraries.join(', ')]]],
  ['Public address', '/settings url', [['Address', s.publicUrl], ['Used for', 'Links the Discord bot sends']]],
]

export default function ChatSettings() {
  return (
    <>
      <Head name="settings" topic="Change things with /settings. Arrmy shows the current values." />
      <div className="lc-feed">
        <Day label="Today" />
        <Msg from="Crafty" time="Today at 14:31"><p><code className="lc-cmd">/settings</code></p></Msg>
        <Msg from="Arrmy" time="Today at 14:31">
          <p>Here is how Arrmy is set up. Press Edit, or type the command shown under each card.</p>
          {SECTIONS.map(([name, cmd, fields]) => (
            <Embed key={name} tone="blurple" title={name}>
              <div className="lc-fields">
                {fields.map(([label, value]) => <span key={label} className="lc-fld"><small>{label}</small>{value}</span>)}
              </div>
              <div className="lc-acts"><button type="button" className="lc-b small">Edit</button><code className="lc-cmd">{cmd}</code></div>
            </Embed>
          ))}
        </Msg>
      </div>
      <Compose channel="settings" value="/settings limits movie 40" hint="Slash commands: /settings limits movie 40 sets the Movie size limit to 40 GB." />
    </>
  )
}
