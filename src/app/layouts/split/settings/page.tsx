import type { Metadata } from 'next'
import { settings } from '../../data'

export const metadata: Metadata = { title: 'Split pane · Settings' }

const { limits, quality, discord, plex, publicUrl } = settings

/** Each section in the list pane and its one-line summary. */
const SECTIONS: [name: string, summary: string][] = [
  ['Size Limits', `${limits.movieGb} GB · ${limits.episodeGbPerHour} GB/h · ${limits.audiobookMb} MB`],
  ['Quality', `${quality.movies} · ${quality.tv} · ${quality.anime}`],
  ['Discord', `${discord.server} ${discord.channel}`],
  ['Plex', `${plex.server} · ${plex.libraries.length} libraries`],
  ['Public address', publicUrl.replace('https://', '')],
]

/** Settings: sections as rows, the selected one (Size Limits) as a form, the next one dimmed below it. */
export default function SplitSettings() {
  return (
    <>
      <section className="list" aria-label="Settings sections">
        <div className="list-top">
          <input className="search" type="search" placeholder="Filter settings…" />
        </div>
        {SECTIONS.map(([name, summary], i) => (
          <button key={name} type="button" className={i === 0 ? 'row plain is-selected' : 'row plain'} aria-pressed={i === 0}>
            <span className="row-text"><b>{name}</b><small>{summary}</small></span>
            <span className="num">›</span>
          </button>
        ))}
      </section>
      <section className="detail" aria-label="Selected section">
        <div className="toolbar">
          <span className="crumb">Settings › Size Limits</span>
          <button type="button" className="tb primary">Save</button>
          <button type="button" className="tb">Reset</button>
        </div>
        <div className="body">
          <h1 style={{ margin: '0 0 4px', fontSize: 24 }}>Size Limits</h1>
          <p className="meta">Releases bigger than these are skipped, so one Request can't fill the disk.</p>
          <div className="form">
            <label>
              Movie
              <span className="unit"><input type="number" defaultValue={limits.movieGb} /> GB per Movie</span>
              <span className="help">A 4K film with lossless audio is 60–90 GB; a good 1080p one is 10–25 GB.</span>
            </label>
            <label>
              TV Show
              <span className="unit"><input type="number" defaultValue={limits.episodeGbPerHour} /> GB per hour of episode</span>
              <span className="help">Checked per episode, so a 90-minute finale may be bigger than a 45-minute one.</span>
            </label>
            <label>
              Audiobook
              <span className="unit"><input type="number" defaultValue={limits.audiobookMb} /> MB per Audiobook</span>
              <span className="help">A 16-hour book at 64 kbps is about 450 MB.</span>
            </label>
            <label className="opt"><input type="checkbox" defaultChecked /> Tell the Requester when a release was skipped for size</label>
          </div>
          <div className="next">
            <h2 className="lbl"><span>Next: Quality</span><span>Select it in the list to edit</span></h2>
            <div className="form dim" aria-hidden="true">
              <label>Movies<select defaultValue={quality.movies}><option>{quality.movies}</option></select></label>
              <label>TV Shows<select defaultValue={quality.tv}><option>{quality.tv}</option></select></label>
              <label>Anime<select defaultValue={quality.anime}><option>{quality.anime}</option></select></label>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
