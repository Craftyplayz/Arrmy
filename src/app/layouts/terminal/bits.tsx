import type { MockMediaType } from '../data'

/** `[██████░░░░]  62%`: a progress bar made of text, so it lines up in the grid like everything else. */
export const bar = (percent: number, width = 10) => {
  const on = Math.round((percent / 100) * width)
  return `[${'█'.repeat(on)}${'░'.repeat(width - on)}] ${String(percent).padStart(3)}%`
}

/** Status colour classes; takes 'Available' or 'available'. */
export const tone = (status: string) => `lt-st lt-st-${status.toLowerCase()}`

export const TYPE: Record<MockMediaType, string> = { Movie: 'movie', 'TV Show': 'tv', Audiobook: 'audiobook' }

/** A line of key hints: `[r] request  [enter] details`. The key text is written as shown, brackets and all. */
export function Hints({ keys, className = 'lt-hint' }: { keys: [key: string, what: React.ReactNode][]; className?: string }) {
  return (
    <p className={className}>
      {keys.map(([k, what]) => (
        <span key={k}><b>{k}</b> {what}</span>
      ))}
    </p>
  )
}
