import Link from 'next/link'
import { cardKey, type Card } from '@/lib/discoverrules'
import type { Status } from '@/lib/status'
import { Badge } from '../ui'

/** A row of posters that scrolls inside itself; each opens its item page. */
export function Row({ title, cards, statuses }: { title: string; cards: Card[]; statuses: Map<string, Status> }) {
  if (!cards.length) return null
  return (
    <section className="ar-panel">
      <h2>{title}</h2>
      <ul className="dc-row">
        {cards.map((c) => {
          const status = statuses.get(cardKey(c.type, c.id))
          return (
            <li key={c.id}>
              <Link href={`/discover/${c.type}/${c.id}`} className="dc-card">
                {c.poster ? <img src={c.poster} alt="" width={140} height={210} loading="lazy" decoding="async" /> : <span className="dc-nopic" />}
                {status && <Badge status={status} />}
                <b>{c.title}</b>
                {c.year && <small>{c.year}</small>}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
