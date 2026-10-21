import { requests, titles, user, type MockRequest, type MockTitle } from '../data'

/** Today in the mockup: Wednesday 21 October 2026. Every date here is a day of that October. */
export const TODAY = 21

export type CalEvent = { day: number; kind: 'requested' | 'available' | 'release'; title: MockTitle; request?: MockRequest; note?: string }

/** requestedAgo counted back from the 21st, and the day the Available ones reached Plex. */
export const requestedOn: Record<number, number> = { 101: 21, 102: 21, 103: 20, 104: 20, 105: 19, 106: 19, 107: 18, 108: 17, 109: 16, 110: 13, 111: 12, 112: 6 }
const onPlex: Record<number, number> = { 101: 21, 104: 21, 107: 19, 109: 17, 110: 14, 112: 7 }
const releases: [id: number, day: number, note: string][] = [[14, 23, 'Season 2 airs'], [15, 24, '4K release'], [16, 27, 'Season 2 airs'], [5, 29, 'Season 2 airs'], [13, 30, 'New narration out']]

export const events: CalEvent[] = [
  ...requests.map((r): CalEvent => ({ day: requestedOn[r.id], kind: 'requested', title: r.title, request: r })),
  ...requests.filter((r) => r.id in onPlex).map((r): CalEvent => ({ day: onPlex[r.id], kind: 'available', title: r.title, request: r })),
  ...releases.map(([id, day, note]): CalEvent => ({ day, kind: 'release', title: titles.find((t) => t.id === id)!, note })),
].sort((a, b) => a.day - b.day)

export const label = (e: CalEvent) => (e.kind === 'requested' ? `${e.title.title} requested` : e.kind === 'available' ? `${e.title.title} → Plex` : `${e.title.title}: ${e.note}`)
export const upcoming = events.filter((e) => e.day > TODAY).slice(0, 5)

/** The month grid: Mon 28 Sep to Sun 1 Nov as days of October (0 and below are September, 32 is November). */
export const cells = Array.from({ length: 35 }, (_, i) => i - 2)
export const dayNumber = (d: number) => (d <= 0 ? 30 + d : d > 31 ? d - 31 : d)
export const isOther = (d: number) => d <= 0 || d > 31
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const dayName = (d: number) => DOW[(d + 3) % 7] // 1 Oct 2026 is a Thursday
export const dayLabel = (d: number) => `${dayName(d)} ${d} Oct`

/** The class that sets the Media Type colour. */
export const tone = (type: string) => (type === 'Movie' ? 'mv' : type === 'TV Show' ? 'tv' : 'ab')
const HUES: Record<string, number> = { [user.username]: user.avatarHue, Sam: 120, Jo: 20, Alex: 300 }
export const avatarStyle = (name: string) => ({ background: `hsl(${HUES[name] ?? 0} 55% 42%)` })
