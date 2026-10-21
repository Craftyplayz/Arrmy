import type { Metadata } from 'next'
import { poster, recentlyAdded, requests, trending } from '../data'

export const metadata: Metadata = { title: 'Magazine · Home' }

export default function MagazineHome() {
  const [lead, ...rest] = trending
  const asked = requests.filter((r) => r.status !== 'Available').slice(0, 5)
  return (
    <div className="lm-front">
      <div>
        <article className="lm-lead">
          <figure>
            <div className="lm-poster" style={poster(lead.hue)} />
            <figcaption>{lead.title} ({lead.year}). {lead.runtime}, rated {lead.rating}.</figcaption>
          </figure>
          <div>
            <p className="lm-kicker">Lead story</p>
            <h1>{lead.title}</h1>
            <p className="lm-standfirst">{lead.overview}</p>
            <p className="lm-byline">{lead.type} · {lead.year} · {lead.runtime} · {lead.genres.join(', ')}</p>
            <div className="lm-cols">
              <p>A {lead.type} from {lead.year}, running {lead.runtime} and rated {lead.rating} out of 10. {lead.genres.join(' and ')}, and the most looked-at title on Arrmy this week.</p>
              <blockquote className="lm-pull">“Request it and it is in Plex within a day; episodes follow as they air.”</blockquote>
              <p>Requesting adds it to the Plex library for everyone. The Admin sees it on the Editor&rsquo;s desk until it is Available, and you can follow its progress in the Listings.</p>
            </div>
            <button type="button" className="lm-btn">Request it</button>
          </div>
        </article>

        <section className="lm-section">
          <h2 className="lm-kicker">New this week</h2>
          <div className="lm-three">
            {rest.slice(0, 6).map((t) => (
              <article key={t.id} className="lm-story">
                <div className="lm-poster" style={poster(t.hue)} />
                <div>
                  <h3>{t.title}</h3>
                  <p>{t.overview}</p>
                  <small>{t.type} · {t.year} · {t.runtime}</small>
                  <button type="button" className="lm-btn small">Request</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="lm-archive">
          <h2>Search the archive</h2>
          <form>
            <input className="lm-field" placeholder="A title, a series, a narrator…" />
            <button type="button" className="lm-btn">Search</button>
          </form>
          <p className="lm-types">
            Or browse by Media Type:<a href="#">Movies</a><a href="#">TV Shows</a><a href="#">Audiobooks</a>
          </p>
        </section>
      </div>

      <aside className="lm-side">
        <h2 className="lm-kicker">Recently added to Plex</h2>
        <ol className="lm-numbered">
          {recentlyAdded.map((t) => (
            <li key={t.id}>
              <div className="lm-poster" style={poster(t.hue)} />
              <div><b>{t.title}</b><small>{t.type} · {t.year}</small></div>
            </li>
          ))}
        </ol>
        <h2 className="lm-kicker">Most requested</h2>
        <ol className="lm-numbered">
          {asked.map((r) => (
            <li key={r.id}>
              <div className="lm-poster" style={poster(r.title.hue)} />
              <div>
                <b>{r.title.title}</b>
                <small>Requested by {r.requestedBy} · {r.requestedAgo}</small>
                <p className={`lm-status st-${r.status.toLowerCase()}`}>{r.status}{r.progress > 0 && r.progress < 100 && `, ${r.progress}%`}</p>
              </div>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  )
}
