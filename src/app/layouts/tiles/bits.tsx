import { user, type MockStatus } from '../data'

// Crafty's hue comes from the fake user; the others are made up so the avatars tell them apart.
const HUES: Record<string, number> = { Crafty: user.avatarHue, Sam: 20, Jo: 140, Alex: 300 }

export function Avatar({ name, big }: { name: string; big?: boolean }) {
  const hue = HUES[name] ?? 0
  return (
    <span className={big ? 't-av big' : 't-av'} style={{ background: `linear-gradient(135deg, hsl(${hue} 60% 55%), hsl(${hue + 40} 50% 30%))` }} aria-hidden="true">
      {name[0]}
    </span>
  )
}

export function StatusPill({ status, progress }: { status: MockStatus; progress?: number }) {
  return <span className={`t-st ${status.toLowerCase()}`}>{status}{progress !== undefined && ` ${progress}%`}</span>
}

export function Magnifier() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  )
}
