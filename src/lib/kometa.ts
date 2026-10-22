// Kometa runs nightly in its own container, but only Arrmy has what its config needs: the Admin's Plex token (kept at
// sign-in) and the Requests. So Arrmy writes Kometa's files into the folder both mount; the rules are in kometarules.ts.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { getSetting, listRequests } from './db'
import { kometaFiles } from './kometarules'
import { PLEX_URL } from './plex'
import { watchOverview } from './tautulli'

const KOMETA_DIR = process.env.KOMETA_DIR ?? '/kometa'

let said: string | undefined
const once = (why: string) => {
  if (said !== why) console.warn(`[kometa] ${(said = why)}`)
}

async function writeKometa() {
  const plexToken = getSetting<string>('plexToken')
  const tmdbKey = process.env.TMDB_API_KEY
  if (!plexToken) return once('not writing its config: Kometa needs the Plex token Arrmy gets when the Admin signs in')
  if (!tmdbKey) return once('not writing its config: Kometa needs TMDB_API_KEY')
  if (tmdbKey.length > 40) return once("not writing its config: Kometa needs TMDB's short v3 API key, not the v4 read token")
  if (!existsSync(KOMETA_DIR)) return once(`not writing its config: ${KOMETA_DIR} is not mounted`)
  const requests = listRequests()
  // Without Tautulli there's no watch history, so nothing is Leaving soon.
  const leaving = await watchOverview(requests).then((w) => w.unwatched.map((u) => u.r), () => [])
  const changed = []
  for (const [file, text] of Object.entries(kometaFiles({ plexUrl: PLEX_URL, plexToken, tmdbKey, requests, leaving }))) {
    // Kometa fills defaults into config.yml when it runs, so that one is rewritten once after each run. Harmless.
    const path = join(KOMETA_DIR, file)
    if (existsSync(path) && readFileSync(path, 'utf8') === text) continue
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, text, { mode: 0o600 }) // config.yml holds the Plex token
    changed.push(file)
  }
  said = undefined
  if (changed.length) console.log(`[kometa] wrote ${changed.join(', ')}`)
}

export function startKometaConfig() {
  let running = false
  const run = async () => {
    if (running) return
    running = true
    await writeKometa().catch((e) => console.warn(`[kometa] ${(e as Error).message}`))
    running = false
  }
  setTimeout(run, 60_000)
  setInterval(run, 30 * 60_000)
}
