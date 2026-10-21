import type { Metadata } from 'next'
import { settings } from '../../data'
import { Ico, Pal, Row } from '../bits'

export const metadata: Metadata = { title: 'Command palette · Settings' }

const { limits, discord, plex, quality } = settings
const ROWS: [label: string, value: string][] = [
  ['Movie size limit', `${limits.movieGb} GB`],
  ['Episode limit', `${limits.episodeGbPerHour} GB/h`],
  ['Audiobook limit', `${limits.audiobookMb} MB`],
  ['Movie quality', quality.movies],
  ['TV quality', quality.tv],
  ['Anime quality', quality.anime],
  ['Discord', `${discord.enabled ? 'On' : 'Off'}, ${discord.channel}`],
  ['Plex', plex.server],
  ['Plex libraries', plex.libraries.join(', ')],
  ['Public address', settings.publicUrl],
]

export default function PaletteSettings() {
  return (
    <Pal mode="> settings" placeholder="Filter settings…" footer={<><kbd>↑↓</kbd> Move <kbd>↵</kbd> Edit <span className="sp" /> <kbd>esc</kbd> Close</>}>
      {ROWS.map(([label, value], i) => (
        <Row key={label} hot={i === 0} icon={<Ico n="gear" />} title={label} sub={`— ${value}`} right={<><kbd>↵</kbd> Edit</>}>
          {i === 0 && (
            <div className="pal-edit">
              <label htmlFor="pal-movie-gb">{label}</label>
              <input id="pal-movie-gb" defaultValue={limits.movieGb} />
              <span>GB</span>
              <span className="sp" />
              <button type="button" className="pal-btn primary">Save <kbd>↵</kbd></button>
              <button type="button" className="pal-btn">Cancel <kbd>esc</kbd></button>
            </div>
          )}
        </Row>
      ))}
    </Pal>
  )
}
