'use client'

import { setTheme } from './actions'

/** Picks the colour theme for the signed-in person; saves as soon as it changes. */
export function ThemePicker({ themes, current }: { themes: readonly { id: string; label: string }[]; current: string }) {
  return (
    <form action={setTheme} className="side-theme">
      <select name="theme" defaultValue={current} aria-label="Colour theme" className="field" onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {themes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
    </form>
  )
}
