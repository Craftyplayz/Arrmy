import { arr, MOVIES_ROOT, serviceKey, serviceUrl, setCustomFormat, TV_ROOT, type ServiceName } from './arr'
import { getLimits } from './db'
import { applyLimits } from './limits'
import { MULTI_AUDIO } from './releases'
import { LAZYLIBRARIAN_URL, ll } from './books'
import { audiobookBayToken, hookToken, lazyLibrarianKey, sessionSecret } from './token'

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

async function ensureTag(svc: ServiceName, label: string) {
  const tags = await arr<{ id: number; label: string }[]>(svc, '/tag')
  return (tags.find((t) => t.label === label) ?? (await arr<{ id: number }>(svc, '/tag', 'POST', { label }))).id
}

/** Wires the Stack through the Services' APIs. Idempotent; failed steps retry every 30s until the Service is up. */
export function startWiring() {
  const qbit = { host: 'gluetun', port: 8080, username: 'admin', password: process.env.QBIT_PASSWORD }
  const webhook = { url: `http://arrmy:3000/api/hooks/arr?token=${hookToken(sessionSecret())}` }
  const onImport = { onDownload: true, onUpgrade: true }
  const app = (svc: 'radarr' | 'sonarr') => ({ prowlarrUrl: serviceUrl('prowlarr'), baseUrl: serviceUrl(svc), apiKey: serviceKey(svc) })

  let steps: [string, () => Promise<void>][] = [
    ['Radarr root folder', () => ensureRootFolder('radarr', MOVIES_ROOT)],
    ['Radarr → qBittorrent', () => ensureProvider('radarr', 'downloadclient', 'QBittorrent', 'qBittorrent', { ...qbit, movieCategory: 'movies' }, { enable: true })],
    ['Radarr → Arrmy', () => ensureProvider('radarr', 'notification', 'Webhook', 'Arrmy', webhook, onImport)],
    ['Sonarr root folder', () => ensureRootFolder('sonarr', TV_ROOT)],
    ['Sonarr → qBittorrent', () => ensureProvider('sonarr', 'downloadclient', 'QBittorrent', 'qBittorrent', { ...qbit, tvCategory: 'tv' }, { enable: true })],
    ['Sonarr → Arrmy', () => ensureProvider('sonarr', 'notification', 'Webhook', 'Arrmy', webhook, onImport)],
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
    // LazyLibrarian's AudioBook Bay search goes through Arrmy's relay (/api/abb), the main public source of audiobooks.
    // Set once: after that the address is ours, and switching AudioBook Bay off in LazyLibrarian is left alone.
    ['LazyLibrarian → AudioBook Bay', async () => {
      const host = `http://arrmy:3000/api/abb/${audiobookBayToken(sessionSecret())}`
      if ((await ll<string>('readCFG', { name: 'ABB_HOST', group: 'ABB' })) === `[${host}]`) return
      await ll('writeCFG', { name: 'ABB_HOST', group: 'ABB', value: host })
      await ll('writeCFG', { name: 'ABB', group: 'ABB', value: '1' })
      await ll('forceBookSearch', { type: 'AudioBook' }) // look again for every wanted audiobook
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
