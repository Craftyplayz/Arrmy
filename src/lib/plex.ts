import { createHash } from 'node:crypto'
import { MOVIES_ROOT, TV_ROOT } from './arr'
import { sessionSecret } from './token'

export const PLEX_URL = process.env.PLEX_URL ?? 'http://plex:32400'

// Stable per install, so plex.tv sees one "Arrmy" device rather than a new one per sign-in.
const clientId = () => createHash('sha256').update(`arrmy-plex:${sessionSecret()}`).digest('hex').slice(0, 32)

export async function plex<T>(url: string, token?: string, method = 'GET'): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      'X-Plex-Product': 'Arrmy',
      'X-Plex-Client-Identifier': clientId(),
      ...(token && { 'X-Plex-Token': token }),
    },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Plex ${method} ${url.split('?')[0]} → ${res.status}`)
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

/** Starts "Sign in with Plex": the browser goes to authUrl and Plex sends it back to forwardUrl. */
export async function createPin(forwardUrl: string) {
  const pin = await plex<{ id: number; code: string }>('https://plex.tv/api/v2/pins?strong=true', undefined, 'POST')
  const params = new URLSearchParams({
    clientID: clientId(),
    code: pin.code,
    forwardUrl,
    'context[device][product]': 'Arrmy',
  })
  return { pinId: pin.id, authUrl: `https://app.plex.tv/auth#?${params}` }
}

export const pinToken = async (pinId: number) =>
  (await plex<{ authToken: string | null }>(`https://plex.tv/api/v2/pins/${pinId}`)).authToken

/** Who signed in, and whether they own this Plex server (Admin), share it (Requester) or have no access. */
export async function plexAccount(token: string) {
  const [user, resources, identity] = await Promise.all([
    plex<{ id: number; username: string; title: string; thumb?: string }>('https://plex.tv/api/v2/user', token),
    plex<{ clientIdentifier: string; owned: boolean }[]>('https://plex.tv/api/v2/resources', token),
    plex<{ MediaContainer: { machineIdentifier: string } }>(`${PLEX_URL}/identity`),
  ])
  const server = resources.find((r) => r.clientIdentifier === identity.MediaContainer.machineIdentifier)
  const access: 'admin' | 'requester' | undefined = server ? (server.owned ? 'admin' : 'requester') : undefined
  return { id: user.id, username: user.username || user.title, access, avatar: user.thumb }
}

const LIBRARIES = [
  { name: 'Movies', type: 'movie', agent: 'tv.plex.agents.movie', scanner: 'Plex Movie', location: MOVIES_ROOT },
  { name: 'TV Shows', type: 'show', agent: 'tv.plex.agents.series', scanner: 'Plex TV Series', location: TV_ROOT },
]

/** Plex half of the Wiring. Needs the Admin's token, so it runs when the Admin signs in. */
export async function wirePlex(token: string) {
  type Sections = { MediaContainer: { Directory?: { Location: { path: string }[] }[] } }
  const sections = await plex<Sections>(`${PLEX_URL}/library/sections`, token)
  const paths = sections.MediaContainer.Directory?.flatMap((d) => d.Location.map((l) => l.path)) ?? []
  for (const lib of LIBRARIES.filter((l) => !paths.includes(l.location))) {
    await plex(`${PLEX_URL}/library/sections?${new URLSearchParams({ ...lib, language: 'en-US' })}`, token, 'POST')
  }
  // Plex picks up new imports by itself, so the Services need no Plex connection.
  await plex(`${PLEX_URL}/:/prefs?FSEventLibraryUpdatesEnabled=1`, token, 'PUT')
}
