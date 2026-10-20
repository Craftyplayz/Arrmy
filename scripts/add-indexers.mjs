// Adds every public English torrent indexer Prowlarr knows that carries movies, music, TV or books, keeping only those that pass Prowlarr's own test
// (it tests on save). Cloudflare-blocked ones are retried through FlareSolverr. Safe to re-run: existing ones are skipped.
// Run from the repo root: node --env-file=.env scripts/add-indexers.mjs http://<server>:7656
const [url = 'http://localhost:7656'] = process.argv.slice(2)
const key = process.env.PROWLARR_API_KEY
if (!key) throw new Error('PROWLARR_API_KEY must be set')

async function api(path, method = 'GET', body) {
  const res = await fetch(`${url}/api/v1${path}`, {
    method,
    headers: { 'X-Api-Key': key, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) {
    let message = text.slice(0, 300)
    try {
      message = JSON.parse(text)[0].errorMessage ?? message // a failed test is a list of validation errors
    } catch {}
    throw new Error(message)
  }
  return text ? JSON.parse(text) : undefined
}

const [existing, schemas, tags, [profile]] = await Promise.all(['/indexer', '/indexer/schema', '/tag', '/appprofile'].map((p) => api(p)))
const have = new Set(existing.map((i) => i.definitionName))
const flaresolverr = tags.find((t) => t.label === 'flaresolverr')?.id // created by Arrmy's wiring
const media = (s) => s.capabilities.categories.some((c) => [2000, 3000, 5000, 7000].includes(c.id)) // Movies, Audio, TV, Books
const todo = schemas.filter(
  (s) => s.privacy === 'public' && s.protocol === 'torrent' && s.language.startsWith('en') && media(s) && !have.has(s.definitionName),
)

console.log(`${todo.length} to try, ${have.size} already in Prowlarr`)
let added = 0
for (const [n, s] of todo.entries()) {
  const add = (tags) => api('/indexer', 'POST', { ...s, appProfileId: profile.id, tags })
  let result = 'added'
  try {
    await add([])
  } catch (e) {
    try {
      if (!flaresolverr || !/cloudflare/i.test(e.message)) throw e
      await add([flaresolverr])
      result = 'added via FlareSolverr'
    } catch (e) {
      result = `skipped: ${e.message}`
    }
  }
  if (result.startsWith('added')) added++
  console.log(`[${n + 1}/${todo.length}] ${s.name}: ${result}`)
}
console.log(`Done: ${added} added. Prowlarr copies them to Radarr and Sonarr on its next sync.`)
