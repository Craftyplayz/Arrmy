import type { Metadata } from 'next'
import { recentlyAdded, requests, searchResults } from '../data'
import { Hints, tone, TYPE } from './bits'

export const metadata: Metadata = { title: 'Terminal · Home' }

const state = (titleId: number) => requests.find((r) => r.title.id === titleId)?.status

export default function Home() {
  return (
    <>
      <p className="lt-prompt">
        <b>&gt;</b> search: <input className="lt-in" defaultValue="the" size={24} aria-label="Search" />
        <i className="lt-cursor" aria-hidden="true" />
      </p>
      <table className="lt-grid">
        <thead>
          <tr><th>TYPE</th><th>TITLE</th><th>YEAR</th><th>RATING</th><th>RUNTIME</th><th>GENRES</th><th>STATE</th></tr>
        </thead>
        <tbody>
          {searchResults.map((t, i) => {
            const s = state(t.id)
            return (
              <tr key={t.id} className={i === 0 ? 'is-sel' : undefined}>
                <td>{TYPE[t.type]}</td>
                <td>{t.title}</td>
                <td>{t.year}</td>
                <td className="lt-num">{t.rating.toFixed(1)}</td>
                <td>{t.runtime}</td>
                <td>{t.genres.join(',').toLowerCase()}</td>
                <td>{s ? <span className={tone(s)}>{s.toLowerCase()}</span> : <span className="lt-dim">—</span>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <Hints keys={[['[r]', 'request'], ['[enter]', 'details'], ['[tab]', <>type: <span className="lt-on">all</span>/movie/tv/audiobook</>]]} />

      <section className="lt-block">
        <h2 className="lt-h">recent</h2>
        <ul className="lt-list">
          {recentlyAdded.map((t) => (
            <li key={t.id}>
              <span className="lt-st-available">+</span> {t.title} <span className="lt-dim">{t.year} · {TYPE[t.type]}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
