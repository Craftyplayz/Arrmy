import { poster, user, type MockMediaType } from '../data'

/** Hue per Requester, so the same person always gets the same colour. */
const HUES: Record<string, number> = { Crafty: user.avatarHue, Sam: 140, Jo: 320, Alex: 40 }

export function Avatar({ name }: { name: string }) {
  return <span className="lb-avatar" style={{ background: `hsl(${HUES[name] ?? 0} 50% 45%)` }} title={name}>{name[0]}</span>
}

export function Chip({ type }: { type: MockMediaType }) {
  return <span className={`lb-chip t-${type === 'TV Show' ? 'tv' : type.toLowerCase()}`}>{type}</span>
}

export function Thumb({ hue }: { hue: number }) {
  return <span className="lb-thumb" style={poster(hue)} />
}
