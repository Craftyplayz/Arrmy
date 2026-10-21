import type { Metadata } from 'next'
import { settings } from '../../data'

export const metadata: Metadata = { title: 'Pipeline · Settings' }

const SECTIONS: [name: string, sub: string][] = [['Limits', 'How big a download may be'], ['Quality', 'Profile per Media Type'], ['Discord', 'Where the news goes'], ['Plex', 'Server and libraries'], ['Public address', 'The link the bot sends']]
const PROFILES = ['HD-1080p', 'Ultra-HD', 'Any']

export default function PipelineSettings() {
  const { limits, quality, discord, plex, publicUrl } = settings
  return (
    <>
      <div className="lp-head"><h1>Settings</h1><p>Each section is a node on the line. Click one to jump to it; Save is at the end.</p></div>
      <div className="lp-mini">
        {SECTIONS.map(([name, sub], i) => (
          <button key={name} type="button" className={i === 0 ? 'lp-mini-node on' : 'lp-mini-node'}><kbd>{i + 1}</kbd><span><b>{name}</b><small>{sub}</small></span></button>
        ))}
        <button type="button" className="lp-btn primary">Save</button>
      </div>
      <div className="lp-sections">
        <Section n={1} name="Limits" on help="Anything bigger is skipped at the Indexer stage, so one Request can never fill a disk.">
          <label>Movie (GB)<input className="lp-field" type="number" defaultValue={limits.movieGb} /><small>Per film</small></label>
          <label>Episode (GB per hour)<input className="lp-field" type="number" defaultValue={limits.episodeGbPerHour} /><small>A one-hour episode may be up to {limits.episodeGbPerHour} GB</small></label>
          <label>Audiobook (MB)<input className="lp-field" type="number" defaultValue={limits.audiobookMb} /><small>Per book</small></label>
        </Section>
        <Section n={2} name="Quality" help="The profile Radarr and Sonarr grab for each Media Type. Audiobooks take whatever LazyLibrarian finds.">
          {([['Movies', quality.movies], ['TV Shows', quality.tv], ['Anime', quality.anime]] as const).map(([label, value]) => (
            <label key={label}>{label}<select className="lp-field" defaultValue={value}>{PROFILES.map((p) => <option key={p}>{p}</option>)}</select></label>
          ))}
        </Section>
        <Section n={3} name="Discord" help="The bot posts when a Request becomes Available and when something is Stuck.">
          <label className="full"><span className="lp-check"><input type="checkbox" defaultChecked={discord.enabled} />Post to Discord</span></label>
          <label>Server<input className="lp-field" defaultValue={discord.server} /></label>
          <label>Channel<input className="lp-field" defaultValue={discord.channel} /></label>
        </Section>
        <Section n={4} name="Plex" help="Where finished downloads end up. The libraries are scanned after every import.">
          <label>Server<input className="lp-field" defaultValue={plex.server} /></label>
          <label className="full">Libraries<span className="lp-checks">{plex.libraries.map((l) => <span key={l} className="lp-check"><input type="checkbox" defaultChecked />{l}</span>)}</span></label>
        </Section>
        <Section n={5} name="Public address" help="Used in every link the Discord bot sends, so it must work from outside the house.">
          <label className="full">Address<input className="lp-field" defaultValue={publicUrl} /><small>Never the LAN address</small></label>
        </Section>
      </div>
    </>
  )
}

function Section({ n, name, help, on, children }: { n: number; name: string; help: string; on?: boolean; children: React.ReactNode }) {
  return (
    <section className={on ? 'lp-section on' : 'lp-section'}>
      <div><h2><kbd>{n}</kbd>{name}</h2><p>{help}</p></div>
      <div className="lp-fields">{children}</div>
    </section>
  )
}
