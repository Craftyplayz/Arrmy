// Made-up data for the /layouts mockups. Every mockup reads this file and nothing else, so they all show the
// same titles and numbers. None of it is live.

export type MockMediaType = 'Movie' | 'TV Show' | 'Audiobook'
export type MockStatus = 'Requested' | 'Downloading' | 'Importing' | 'Available' | 'Stuck'

export type MockTitle = {
  id: number
  title: string
  year: number
  type: MockMediaType
  /** hue for a placeholder poster: `linear-gradient(160deg, hsl(hue 55% 42%), hsl(hue+40 45% 18%))` */
  hue: number
  overview: string
  runtime: string
  rating: number
  genres: string[]
}

export type MockRequest = {
  id: number
  title: MockTitle
  requestedBy: string
  /** "2 h ago", "yesterday", "3 days ago" */
  requestedAgo: string
  status: MockStatus
  /** 0..100, only meaningful while Downloading or Importing */
  progress: number
  /** what was asked for: "Seasons 1, 2", "Movie", "Audiobook" */
  detail: string
  sizeGb: number
}

export const user = { username: 'Crafty', isAdmin: true, avatarHue: 200 }

export const titles: MockTitle[] = [
  { id: 1, title: 'Dune: Part Two', year: 2024, type: 'Movie', hue: 30, overview: 'Paul Atreides unites with the Fremen while seeking revenge against the conspirators who destroyed his family.', runtime: '2h 46m', rating: 8.5, genres: ['Sci-Fi', 'Adventure'] },
  { id: 2, title: 'Severance', year: 2022, type: 'TV Show', hue: 200, overview: 'Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives.', runtime: '2 seasons', rating: 8.7, genres: ['Drama', 'Mystery'] },
  { id: 3, title: 'The Bear', year: 2022, type: 'TV Show', hue: 10, overview: 'A young chef from the fine dining world returns to Chicago to run his family sandwich shop.', runtime: '3 seasons', rating: 8.6, genres: ['Comedy', 'Drama'] },
  { id: 4, title: 'Arrival', year: 2016, type: 'Movie', hue: 220, overview: 'A linguist works with the military to communicate with alien lifeforms after twelve mysterious spacecraft appear around the world.', runtime: '1h 56m', rating: 7.9, genres: ['Sci-Fi', 'Drama'] },
  { id: 5, title: 'Shōgun', year: 2024, type: 'TV Show', hue: 350, overview: 'In 1600s Japan, an English sailor washes ashore and becomes entangled in the plots of a feudal lord.', runtime: '1 season', rating: 8.7, genres: ['Drama', 'History'] },
  { id: 6, title: 'Project Hail Mary', year: 2021, type: 'Audiobook', hue: 140, overview: 'A lone astronaut must save the earth from disaster. Narrated by Ray Porter.', runtime: '16h 10m', rating: 4.8, genres: ['Sci-Fi'] },
  { id: 7, title: 'Andor', year: 2022, type: 'TV Show', hue: 260, overview: 'The story of the rebellion against the Empire, five years before Rogue One.', runtime: '2 seasons', rating: 8.4, genres: ['Sci-Fi', 'Drama'] },
  { id: 8, title: 'Past Lives', year: 2023, type: 'Movie', hue: 300, overview: 'Two childhood friends are reunited decades later for one week in New York.', runtime: '1h 45m', rating: 7.8, genres: ['Romance', 'Drama'] },
  { id: 9, title: 'The Martian', year: 2011, type: 'Audiobook', hue: 20, overview: 'Stranded on Mars, an astronaut must rely on his ingenuity to survive. Narrated by R.C. Bray.', runtime: '10h 53m', rating: 4.7, genres: ['Sci-Fi'] },
  { id: 10, title: 'Oppenheimer', year: 2023, type: 'Movie', hue: 40, overview: 'The story of J. Robert Oppenheimer and the making of the atomic bomb.', runtime: '3h 0m', rating: 8.3, genres: ['Drama', 'History'] },
  { id: 11, title: 'Slow Horses', year: 2022, type: 'TV Show', hue: 90, overview: 'A team of disgraced MI5 agents are sent to Slough House, where failed spies go to be forgotten.', runtime: '4 seasons', rating: 8.2, genres: ['Thriller', 'Drama'] },
  { id: 12, title: 'Everything Everywhere All at Once', year: 2022, type: 'Movie', hue: 320, overview: 'A laundromat owner is swept into an adventure across the multiverse.', runtime: '2h 19m', rating: 7.8, genres: ['Comedy', 'Sci-Fi'] },
  { id: 13, title: 'Children of Time', year: 2015, type: 'Audiobook', hue: 170, overview: 'Humanity\'s last survivors find a terraformed planet already taken. Narrated by Mel Hudson.', runtime: '16h 31m', rating: 4.5, genres: ['Sci-Fi'] },
  { id: 14, title: 'Fallout', year: 2024, type: 'TV Show', hue: 55, overview: 'Two hundred years after the apocalypse, a vault dweller ventures out into the wasteland.', runtime: '1 season', rating: 8.4, genres: ['Sci-Fi', 'Action'] },
  { id: 15, title: 'Poor Things', year: 2023, type: 'Movie', hue: 280, overview: 'A young woman brought back to life by a scientist runs off to see the world.', runtime: '2h 21m', rating: 7.9, genres: ['Comedy', 'Fantasy'] },
  { id: 16, title: 'Blue Eye Samurai', year: 2023, type: 'TV Show', hue: 230, overview: 'A mixed-race master of the sword seeks revenge in Edo-period Japan.', runtime: '1 season', rating: 8.7, genres: ['Animation', 'Action'] },
]

const t = (id: number) => titles.find((x) => x.id === id)!

export const requests: MockRequest[] = [
  { id: 101, title: t(1), requestedBy: 'Crafty', requestedAgo: '2 h ago', status: 'Available', progress: 100, detail: 'Movie', sizeGb: 24.1 },
  { id: 102, title: t(2), requestedBy: 'Sam', requestedAgo: '5 h ago', status: 'Downloading', progress: 62, detail: 'Seasons 1, 2', sizeGb: 38.4 },
  { id: 103, title: t(3), requestedBy: 'Jo', requestedAgo: 'yesterday', status: 'Requested', progress: 0, detail: 'Season 3', sizeGb: 0 },
  { id: 104, title: t(4), requestedBy: 'Crafty', requestedAgo: 'yesterday', status: 'Available', progress: 100, detail: 'Movie', sizeGb: 14.8 },
  { id: 105, title: t(5), requestedBy: 'Alex', requestedAgo: '2 days ago', status: 'Importing', progress: 96, detail: 'Season 1', sizeGb: 29.2 },
  { id: 106, title: t(6), requestedBy: 'Sam', requestedAgo: '2 days ago', status: 'Downloading', progress: 18, detail: 'Audiobook', sizeGb: 0.5 },
  { id: 107, title: t(7), requestedBy: 'Crafty', requestedAgo: '3 days ago', status: 'Available', progress: 100, detail: 'Seasons 1, 2', sizeGb: 41.0 },
  { id: 108, title: t(8), requestedBy: 'Jo', requestedAgo: '4 days ago', status: 'Stuck', progress: 0, detail: 'Movie', sizeGb: 0 },
  { id: 109, title: t(9), requestedBy: 'Alex', requestedAgo: '5 days ago', status: 'Available', progress: 100, detail: 'Audiobook', sizeGb: 0.4 },
  { id: 110, title: t(10), requestedBy: 'Crafty', requestedAgo: 'last week', status: 'Available', progress: 100, detail: 'Movie', sizeGb: 31.6 },
  { id: 111, title: t(11), requestedBy: 'Sam', requestedAgo: 'last week', status: 'Downloading', progress: 44, detail: 'Season 4', sizeGb: 12.3 },
  { id: 112, title: t(12), requestedBy: 'Jo', requestedAgo: '2 weeks ago', status: 'Available', progress: 100, detail: 'Movie', sizeGb: 18.9 },
]

/** What a search for "the" might return: titles not yet requested first. */
export const searchResults: MockTitle[] = [t(14), t(15), t(16), t(13), t(3), t(9)]

/** Rows for the "trending" / "new this week" strips on a home page. */
export const trending: MockTitle[] = [t(14), t(16), t(10), t(15), t(5), t(12), t(13), t(11)]
export const recentlyAdded: MockTitle[] = [t(1), t(4), t(7), t(10), t(12), t(9)]

export const admin = {
  counts: { requested: 1, downloading: 3, importing: 1, available: 6, stuck: 1 },
  disks: [
    { name: 'Movies', usedTb: 3.2, totalTb: 4.0 },
    { name: 'TV', usedTb: 5.8, totalTb: 8.0 },
    { name: 'Audiobooks', usedTb: 0.12, totalTb: 1.0 },
  ],
  downloads: [
    { title: 'Severance S02', speedMbs: 12.4, eta: '41 min', progress: 62, seeds: 48 },
    { title: 'Slow Horses S04E03', speedMbs: 3.1, eta: '2 h 10 min', progress: 44, seeds: 7 },
    { title: 'Project Hail Mary (Ray Porter)', speedMbs: 0.4, eta: '18 min', progress: 18, seeds: 2 },
  ],
  problems: [
    { title: 'Past Lives', what: 'No release found in 4 days. Radarr has searched 6 times.', fix: 'Search again' },
    { title: 'Shōgun S01E09', what: 'Import failed: file already exists with a different name.', fix: 'Replace file' },
  ],
  services: [
    { name: 'Radarr', ok: true, version: '5.14.0' },
    { name: 'Sonarr', ok: true, version: '4.0.11' },
    { name: 'Prowlarr', ok: true, version: '1.28.2' },
    { name: 'qBittorrent', ok: true, version: '5.0.3' },
    { name: 'LazyLibrarian', ok: false, version: '—' },
    { name: 'Plex', ok: true, version: '1.41.3' },
  ],
  requesters: [
    { name: 'Crafty', requests: 4, admin: true },
    { name: 'Sam', requests: 3, admin: false },
    { name: 'Jo', requests: 3, admin: false },
    { name: 'Alex', requests: 2, admin: false },
  ],
}

export const settings = {
  limits: { movieGb: 40, episodeGbPerHour: 4, audiobookMb: 600 },
  discord: { enabled: true, server: 'The Crafty Lounge', channel: '#arrmy' },
  plex: { server: 'Crafty Plex', libraries: ['Movies', 'TV Shows', 'Audiobooks'] },
  quality: { movies: 'HD-1080p', tv: 'HD-1080p', anime: 'Any' },
  publicUrl: 'https://arrmy.craftyplayz.com',
}

export const poster = (hue: number) => ({ background: `linear-gradient(160deg, hsl(${hue} 55% 42%), hsl(${hue + 40} 45% 18%))` })
