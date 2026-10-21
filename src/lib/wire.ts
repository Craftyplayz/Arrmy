import { arr, MOVIES_ROOT, serviceKey, serviceUrl, setCustomFormat, TV_ROOT, type ServiceName } from './arr'
import { getLimits, getSetting, setSetting } from './db'
import { applyLimits } from './limits'
import { MULTI_AUDIO } from './releases'
import { LAZYLIBRARIAN_URL, ll } from './books'
import { relayAddress } from './abbrelay'
import { qbit as qbitApi } from './qbit'
import { hookToken, lazyLibrarianKey, sessionSecret } from './token'

type Provider = { name: string; implementation: string; fields: { name: string; value?: unknown }[] }

async function ensureRootFolder(svc: ServiceName, path: string) {
  const folders = await arr<{ path: string }[]>(svc, '/rootfolder')
  if (!folders.some((f) => f.path === path)) await arr(svc, '/rootfolder', 'POST', { path })
}

/** Adds a download client, connection or app from the Service's own schema, so every field we don't set keeps its default. */
async function ensureProvider(
  svc: ServiceName,
  resource: string,
  implementation: string,
  name: string,
  values: Record<string, unknown>,
  extra: Record<string, unknown>,
) {
  if ((await arr<Provider[]>(svc, `/${resource}`)).some((p) => p.name === name)) return
  const schema = (await arr<Provider[]>(svc, `/${resource}/schema`)).find((p) => p.implementation === implementation)
  if (!schema) throw new Error(`${svc} has no ${implementation} ${resource}`)
  const fields = schema.fields.map((f) => (f.name in values ? { ...f, value: values[f.name] } : f))
  await arr(svc, `/${resource}`, 'POST', { ...schema, ...extra, name, fields })
}

/** Switches on settings of a provider made by an older Arrmy, which ensureProvider leaves alone once it exists. */
async function ensureFlags(svc: ServiceName, resource: string, name: string, flags: Record<string, boolean>) {
  const p = (await arr<(Provider & { id: number } & Record<string, unknown>)[]>(svc, `/${resource}`)).find((x) => x.name === name)
  if (p && Object.entries(flags).some(([k, v]) => p[k] !== v)) await arr(svc, `/${resource}/${p.id}`, 'PUT', { ...p, ...flags })
}

async function ensureTag(svc: ServiceName, label: string) {
  const tags = await arr<{ id: number; label: string }[]>(svc, '/tag')
  return (tags.find((t) => t.label === label) ?? (await arr<{ id: number }>(svc, '/tag', 'POST', { label }))).id
}

/** Wires the Stack through the Services' APIs. Idempotent; failed steps retry every 30s until the Service is up. */
export function startWiring() {
  const qbit = { host: 'gluetun', port: 8080, username: 'admin', password: process.env.QBIT_PASSWORD }
  const webhook = { url: `http://arrmy:3000/api/hooks/arr?token=${hookToken(sessionSecret())}` }
  const events = { onGrab: true, onDownload: true, onUpgrade: true } // grabs feed the Request Log
  const app = (svc: 'radarr' | 'sonarr') => ({ prowlarrUrl: serviceUrl('prowlarr'), baseUrl: serviceUrl(svc), apiKey: serviceKey(svc) })

  let steps: [string, () => Promise<void>][] = [
    ['Radarr root folder', () => ensureRootFolder('radarr', MOVIES_ROOT)],
    ['Radarr → qBittorrent', () => ensureProvider('radarr', 'downloadclient', 'QBittorrent', 'qBittorrent', { ...qbit, movieCategory: 'movies' }, { enable: true })],
    ['Radarr → Arrmy', () => ensureProvider('radarr', 'notification', 'Webhook', 'Arrmy', webhook, events)],
    ['Radarr → Arrmy on grab', () => ensureFlags('radarr', 'notification', 'Arrmy', events)],
    ['Sonarr root folder', () => ensureRootFolder('sonarr', TV_ROOT)],
    ['Sonarr → qBittorrent', () => ensureProvider('sonarr', 'downloadclient', 'QBittorrent', 'qBittorrent', { ...qbit, tvCategory: 'tv' }, { enable: true })],
    ['Sonarr → Arrmy', () => ensureProvider('sonarr', 'notification', 'Webhook', 'Arrmy', webhook, events)],
    ['Sonarr → Arrmy on grab', () => ensureFlags('sonarr', 'notification', 'Arrmy', events)],
    ['Prowlarr → Radarr', () => ensureProvider('prowlarr', 'applications', 'Radarr', 'Radarr', app('radarr'), { syncLevel: 'fullSync' })],
    ['Prowlarr → Sonarr', () => ensureProvider('prowlarr', 'applications', 'Sonarr', 'Sonarr', app('sonarr'), { syncLevel: 'fullSync' })],
    ['Prowlarr → LazyLibrarian', () =>
      ensureProvider('prowlarr', 'applications', 'LazyLibrarian', 'LazyLibrarian',
        { prowlarrUrl: serviceUrl('prowlarr'), baseUrl: LAZYLIBRARIAN_URL, apiKey: lazyLibrarianKey(sessionSecret()) },
        { syncLevel: 'fullSync' })],
    // Prowlarr only sends an indexer through FlareSolverr when the indexer has the same tag.
    ['Prowlarr → FlareSolverr', async () => {
      const tag = await ensureTag('prowlarr', 'flaresolverr')
      await ensureProvider('prowlarr', 'indexerproxy', 'FlareSolverr', 'FlareSolverr', { host: 'http://gluetun:8191/' }, { tags: [tag] })
    }],
    // LazyLibrarian's AudioBook Bay search goes through Arrmy's relay (abbrelay.ts), the main public source of audiobooks.
    // Set once: after that the address is ours, and switching AudioBook Bay off in LazyLibrarian is left alone.
    ['LazyLibrarian → AudioBook Bay', async () => {
      const host = relayAddress()
      if (getSetting<string>('wired:audiobookBay') === host) return
      if ((await ll<string>('readCFG', { name: 'ABB_HOST', group: 'ABB' })) !== `[${host}]`) {
        await ll('writeCFG', { name: 'ABB_HOST', group: 'ABB', value: host })
        await ll('writeCFG', { name: 'ABB', group: 'ABB', value: '1' })
      }
      // Look again for every wanted audiobook. Fails while LazyLibrarian is starting, or has blocked its sources (for
      // an hour after errors, e.g. a restart mid-search), so it's only marked done once the search has started.
      await ll('forceBookSearch', { type: 'AudioBook' })
      setSetting('wired:audiobookBay', host)
    }],
    // The VueTorrent Docker mod is gone (its download from ghcr.io hung qBittorrent's start), and /vuetorrent with it,
    // so the alternative web UI that older Arrmy versions switched on goes back off. Set once, like VueTorrent was.
    ['qBittorrent: built-in web UI', async () => {
      if (getSetting<boolean>('wired:vuetorrentOff')) return
      await qbitApi('/app/setPreferences', new URLSearchParams({ json: JSON.stringify({ alternative_webui_enabled: false }) }))
      setSetting('wired:vuetorrentOff', true)
    }],
    // Audiobook results under 50 MB are ebooks posted as audiobooks (a 2 MB "La Belle Sauvage" got grabbed three times).
    // Set once, like AudioBook Bay, so a different value chosen in LazyLibrarian later is left alone.
    ['LazyLibrarian: audiobooks under 50 MB skipped', async () => {
      if (getSetting<boolean>('wired:audiobookMinSize')) return
      await ll('writeCFG', { name: 'REJECT_MINAUDIO', group: 'Magazines', value: '50' })
      setSetting('wired:audiobookMinSize', true)
    }],
    // Re-applied every start, so a rebuilt Radarr or Sonarr gets the Admin's Size Limits back.
    ['Size limits', () => applyLimits(getLimits())],
    // At the same quality, a release with only English audio beats MULTi, Dual Audio or another language: less space.
    // Untagged releases count as the title's original language, so foreign films and anime are left as they were.
    ['English-only audio', async () => {
      for (const svc of ['radarr', 'sonarr'] as const)
        await setCustomFormat(svc, 'Arrmy English-only audio', 10, [
          { implementation: 'LanguageSpecification', name: 'No language but English', negate: true, values: { value: 1, exceptLanguage: true } },
          { implementation: 'ReleaseTitleSpecification', name: 'Not multi-audio', negate: true, values: { value: MULTI_AUDIO } },
        ])
    }],
  ]

  const run = async () => {
    const failed: typeof steps = []
    for (const step of steps) {
      try {
        await step[1]()
      } catch (e) {
        failed.push(step)
        console.warn(`[wire] ${step[0]} failed, retrying in 30s: ${(e as Error).message}`)
      }
    }
    steps = failed
    if (steps.length) setTimeout(run, 30_000)
    else console.log('[wire] Stack wired')
  }
  setTimeout(run, 5_000)
}
