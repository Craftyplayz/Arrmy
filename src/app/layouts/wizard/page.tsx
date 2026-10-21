import type { Metadata } from 'next'
import { poster, searchResults } from '../data'

export const metadata: Metadata = { title: 'One thing at a time · Home' }

const STEPS = 4
// The Bear: a TV Show, so Step 3 has seasons to choose. Its runtime says how many.
const PICK = searchResults[4]
const SEASONS = Array.from({ length: parseInt(PICK.runtime) }, (_, i) => i + 1)
const CHOSEN = 3

export default function WizardHome() {
  return (
    <div className="wz-page">
      <h1 className="wz-title">New Request</h1>
      <p className="wz-lede">Four short questions. On the real thing you'd see one at a time; here they're all laid out so you can see every screen.</p>

      <Step n={1} current question="What do you want to watch or listen to?" hint="A title, or part of one. Pick a Media Type if you want to narrow it down." action="Next">
        <input className="wz-search" type="search" defaultValue="the" placeholder="Type a title…" aria-label="Search" />
        <div className="wz-pills">
          {['All', 'Movie', 'TV Show', 'Audiobook'].map((m) => <button key={m} type="button" className={m === 'All' ? 'wz-pill on' : 'wz-pill'}>{m}</button>)}
        </div>
      </Step>

      <Step n={2} question="Is it one of these?" hint="Tap the one you mean. Not here? Go back and try another spelling." action="Next" back>
        <div className="wz-results">
          {searchResults.map((t) => (
            <div key={t.id} className={t.id === PICK.id ? 'wz-result is-picked' : 'wz-result'}>
              <div className="wz-poster" style={poster(t.hue)} />
              <div>
                <h3>{t.title}</h3>
                <p className="wz-kind">{t.year} · {t.type} · {t.runtime}</p>
                <p>{t.overview}</p>
              </div>
              {t.id === PICK.id && <span className="wz-picked-tag">Picked</span>}
            </div>
          ))}
        </div>
      </Step>

      <Step n={3} question="Which seasons?" hint={`${PICK.title} has ${PICK.runtime}. Pick the ones you want, or all of them.`} action="Next" back>
        <div className="wz-pills big">
          {SEASONS.map((s) => <button key={s} type="button" className={s === CHOSEN ? 'wz-pill on' : 'wz-pill'}>Season {s}</button>)}
          <button type="button" className="wz-pill">All</button>
        </div>
      </Step>

      <Step n={4} question="All set" hint="Here's what you're asking for." action="Request it" big back>
        <div className="wz-summary">
          <div className="wz-poster" style={poster(PICK.hue)} />
          <div>
            <h3>{PICK.title}</h3>
            <p>{PICK.year} · {PICK.type} · Season {CHOSEN}</p>
          </div>
        </div>
        <p className="wz-promise">We'll tell you on Discord when it's Available.</p>
      </Step>
    </div>
  )
}

/** One screen of the flow. Only the current one is bright; the rest are dimmed so the whole flow fits on one page. */
function Step({ n, question, hint, action, current, back, big, children }: { n: number; question: string; hint: string; action: string; current?: boolean; back?: boolean; big?: boolean; children: React.ReactNode }) {
  return (
    <section className={current ? 'wz-step is-current' : 'wz-step is-later'}>
      <p className="wz-progress">
        <span className="wz-dots">{Array.from({ length: STEPS }, (_, i) => <i key={i} className={i < n ? 'on' : ''} />)}</span>
        Step {n} of {STEPS}
      </p>
      <h2 className="wz-q">{question}</h2>
      <p className="wz-hint">{hint}</p>
      {children}
      <p className="wz-actions">
        <button type="button" className={big ? 'wz-btn big' : 'wz-btn'}>{action}</button>
        {back && <button type="button" className="wz-btn ghost">Back</button>}
      </p>
    </section>
  )
}
