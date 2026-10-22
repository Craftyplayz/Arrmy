'use client'

import { useEffect, useRef, useState } from 'react'
import type { Suggestion } from '@/lib/arr'

const TYPE_NAMES: Record<string, string> = { movie: 'Movie', tv: 'TV Show', audiobook: 'Audiobook' }

/**
 * The search field, with titles suggested as a person types, only from the tab they are on. Picking one searches for
 * that title; Enter without picking searches for what was typed, as before.
 */
export function SuggestField({ type, q, placeholder, label }: { type: string; q: string; placeholder: string; label: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [term, setTerm] = useState('')
  const [items, setItems] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  useEffect(() => {
    if (term.trim().length < 2) return setItems([])
    const abort = new AbortController()
    // waits for a pause in typing, so Radarr and Sonarr aren't asked on every key
    const timer = setTimeout(() => {
      fetch(`/api/suggest?type=${type}&q=${encodeURIComponent(term)}`, { signal: abort.signal })
        .then((res) => (res.ok ? res.json() : []))
        .then((s: Suggestion[]) => {
          setItems(s)
          setActive(-1)
        })
        .catch(() => {}) // aborted, or the search is down: no suggestions
    }, 300)
    return () => {
      clearTimeout(timer)
      abort.abort()
    }
  }, [term, type])

  const pick = (s: Suggestion) => {
    input.current!.value = s.title
    setOpen(false)
    input.current!.form?.requestSubmit()
  }

  const shown = open && items.length > 0
  return (
    <>
      <input
        ref={input}
        className="field"
        type="search"
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        aria-label={label}
        autoFocus
        autoComplete="off"
        role="combobox"
        aria-expanded={shown}
        aria-controls="suggest"
        aria-autocomplete="list"
        aria-activedescendant={shown && active >= 0 ? `suggest-${active}` : undefined}
        onChange={(e) => {
          setTerm(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!shown) return
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            const step = e.key === 'ArrowDown' ? 1 : -1
            // -1 is the typed text itself; the arrows cycle through it and every suggestion
            setActive((a) => ((a + 1 + step + items.length + 1) % (items.length + 1)) - 1)
          } else if (e.key === 'Escape') setOpen(false)
          else if (e.key === 'Enter' && active >= 0) {
            e.preventDefault()
            pick(items[active])
          } else if (e.key === 'Enter') setOpen(false)
        }}
      />
      {shown && (
        <ul className="ar-suggest" id="suggest" role="listbox" aria-label="Suggestions">
          {items.map((s, i) => (
            <li
              key={`${s.type}-${s.id}`}
              id={`suggest-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: the field would lose focus and close the list first
              onMouseDown={(e) => {
                e.preventDefault()
                pick(s)
              }}
            >
              {s.poster ? <img src={s.poster} alt="" width={32} height={48} /> : <span className="ar-suggest-poster" />}
              <span className="grow">
                {s.title}
                <small>
                  <span className={`ar-type ar-type-${s.type}`}>{TYPE_NAMES[s.type]}</span>
                  {s.year}
                  {s.status && ` · ${s.status}`}
                </small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
