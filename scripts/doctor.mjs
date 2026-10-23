// The doctor: when Arrmy announces a Problem, a Claude Code agent looks into it, and Arrmy posts each step it takes and
// what it found in the Problem's thread.
// It runs on the Admin's Claude subscription (CLAUDE_CODE_OAUTH_TOKEN, from `claude setup-token`). The agent can read every
// app's API, but can only change things through the safe fixes in FIXES: no shell, no file edits, no Docker.
//   node doctor.mjs                       the server Arrmy posts Problems to (port 3002, inside Docker only)
//   node doctor.mjs get <app> <path>      how the agent reads an API
//   node doctor.mjs fix <name> <args...>  how the agent fixes something
import { execFileSync, spawn } from 'node:child_process'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

const SELF = fileURLToPath(import.meta.url)
const HOME = process.env.HOME ?? '/config'
const CLAUDE = `${HOME}/cli/node_modules/.bin/claude`
const QBIT_URL = process.env.QBIT_URL ?? 'http://gluetun:8080'
const GLUETUN_URL = process.env.GLUETUN_URL ?? 'http://gluetun:8000'
const ARRMY_URL = process.env.ARRMY_URL ?? 'http://arrmy:3001'
const REGIONS = `${HOME}/vpn-regions.json`
const APPS = {
  radarr: { url: process.env.RADARR_URL ?? 'http://radarr:7878', key: process.env.RADARR_API_KEY, api: 'v3' },
  sonarr: { url: process.env.SONARR_URL ?? 'http://sonarr:8989', key: process.env.SONARR_API_KEY, api: 'v3' },
  prowlarr: { url: process.env.PROWLARR_URL ?? 'http://prowlarr:9696', key: process.env.PROWLARR_API_KEY, api: 'v1' },
}
const DAY = 24 * 3_600_000
const SECRET = process.env.SESSION_SECRET ?? ''
// token.ts doctorToken derives the same; this server and Arrmy's /doctor API both check it.
const doctorToken = () => createHmac('sha256', SECRET).update('doctor').digest('base64url')
/** The doctor's key to gluetun's control server; init.mjs writes the same into /gluetun/auth/config.toml. */
export const gluetunKey = (secret) => createHmac('sha256', secret).update('gluetun').digest('hex').slice(0, 32)

async function arr(app, path, method = 'GET', body) {
  const { url, key, api } = APPS[app]
  const res = await fetch(`${url}/api/${api}${path}`, {
    method,
    headers: { 'X-Api-Key': key ?? '', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${app} ${method} ${path} → ${res.status} ${text.slice(0, 300)}`)
  return text
}

async function qbit(path, form) {
  const login = await fetch(`${QBIT_URL}/api/v2/auth/login`, {
    method: 'POST',
    body: new URLSearchParams({ username: 'admin', password: process.env.QBIT_PASSWORD ?? '' }),
  })
  // qBittorrent 5 names the cookie after its port (QBT_SID_8080); older versions call it SID.
  const sid = login.headers.getSetCookie().find((c) => /^(QBT_)?SID(_\d+)?=/.test(c))?.split(';')[0]
  if (!sid) throw new Error(`qBittorrent login → ${login.status}`)
  const res = await fetch(`${QBIT_URL}/api/v2${path}`, { method: form ? 'POST' : 'GET', headers: { Cookie: sid }, body: form })
  if (!res.ok) throw new Error(`qBittorrent ${path} → ${res.status}`)
  return res.text()
}

async function gluetun(path, method = 'GET', body) {
  const res = await fetch(`${GLUETUN_URL}${path}`, {
    method,
    headers: { 'X-API-Key': gluetunKey(SECRET), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`gluetun ${method} ${path} → ${res.status} ${text.slice(0, 300)}`)
  return text
}

/** Arrmy's internal API for the doctor: waiting Editions, an AudioBook Bay check, a new search. */
async function arrmy(path, method = 'GET') {
  const res = await fetch(`${ARRMY_URL}/doctor${path}`, {
    method,
    headers: { Authorization: `Bearer ${doctorToken()}` },
    signal: AbortSignal.timeout(120_000),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`arrmy ${method} ${path} → ${res.status} ${text.slice(0, 300)}`)
  return text
}

const ids = (list) => {
  const n = list.map(Number)
  if (!n.length || !n.every((x) => Number.isInteger(x) && x > 0)) throw new Error('ids must be positive whole numbers')
  return n
}
const arrApp = (app) => {
  if (app !== 'radarr' && app !== 'sonarr') throw new Error('app must be radarr or sonarr')
  return app
}
const hash = (h) => {
  if (!/^[a-f0-9]{40}$/i.test(h ?? '')) throw new Error('hash must be a 40-character torrent hash')
  return h.toLowerCase()
}

const editionId = (words) => {
  const id = words.join(' ') // the agent may leave a narrator's name unquoted
  if (!/^[\p{L}\d ~.'-]{1,120}$/u.test(id)) throw new Error('id must be an Edition id like "OL27513W~andy serkis"')
  return id
}

/**
 * Which PIA region to try next for AudioBook Bay: ones it worked in (latest first), then ones never tried (at random),
 * then ones it failed in (longest ago first). Skips `tried`; null when nothing is left.
 * history: { [region]: { ok?: time, failed?: time } }, when AudioBook Bay last worked or failed there.
 */
export function nextRegion(history, candidates, tried, pick = (list) => list[Math.floor(Math.random() * list.length)]) {
  const left = candidates.filter((r) => !tried.includes(r))
  const worked = left.filter((r) => history[r]?.ok && !(history[r].failed > history[r].ok)).sort((a, b) => history[b].ok - history[a].ok)
  if (worked.length) return worked[0]
  const fresh = left.filter((r) => !history[r])
  if (fresh.length) return pick(fresh)
  return left.sort((a, b) => (history[a].failed ?? 0) - (history[b].failed ?? 0))[0] ?? null
}

/** PIA's port-forwarding regions, named as gluetun names them. The list is JSON on the first line, then a signature. */
async function piaRegions() {
  const res = await fetch('https://serverlist.piaservers.net/vpninfo/servers/v6', { signal: AbortSignal.timeout(20_000) })
  return JSON.parse((await res.text()).split('\n')[0]).regions.filter((r) => r.port_forward).map((r) => r.name)
}

/** Waits until gluetun is connected again with a new public IP, and returns that IP's details. */
async function reconnected(before) {
  for (const end = Date.now() + 120_000; Date.now() < end; await new Promise((r) => setTimeout(r, 3000))) {
    try {
      const { status } = JSON.parse(await gluetun('/v1/vpn/status'))
      const ip = JSON.parse(await gluetun('/v1/publicip/ip'))
      if (status === 'running' && ip.public_ip && ip.public_ip !== before) return ip
    } catch {} // gluetun answers nothing useful mid-reconnect
  }
  throw new Error('no new public IP within 2 minutes')
}

/**
 * Moves the VPN to other regions until AudioBook Bay answers, up to 4 tries, and remembers where it worked.
 * gluetun reconnects when its regions change (PUT /v1/vpn/settings) and keeps them until it restarts.
 */
async function reconnectVpn() {
  let history = {}
  try {
    history = JSON.parse(readFileSync(REGIONS, 'utf8'))
  } catch {} // first run
  const regions = [...new Set([...(await piaRegions().catch(() => [])), ...Object.keys(history)])]
  const tried = []
  const report = []
  let ok = false
  for (let i = 1; i <= 4 && !ok; i++) {
    const region = nextRegion(history, regions, tried)
    if (region) tried.push(region)
    let line = `${i}. ${region ?? 'a random region'}: `
    try {
      const before = JSON.parse(await gluetun('/v1/publicip/ip').catch(() => '{}')).public_ip
      if (region) await gluetun('/v1/vpn/settings', 'PUT', { provider: { server_selection: { regions: [region] } } })
      else {
        // No region list to steer by: a plain reconnect picks one at random.
        await gluetun('/v1/vpn/status', 'PUT', { status: 'stopped' })
        await gluetun('/v1/vpn/status', 'PUT', { status: 'running' })
      }
      const ip = await reconnected(before)
      line += `${ip.public_ip} (${[ip.city, ip.country].filter(Boolean).join(', ')}), `
      const abb = JSON.parse(await arrmy('/abb?s=tolkien'))
      ok = abb.ok === true
      line += ok ? `AudioBook Bay ok in ${abb.ms} ms` : `AudioBook Bay failed: ${abb.error}`
    } catch (e) {
      line += `failed: ${e.message}`
    }
    report.push(line)
    if (region) history[region] = { ...history[region], [ok ? 'ok' : 'failed']: Date.now() }
  }
  writeFileSync(REGIONS, JSON.stringify(history, null, 2))
  // Whatever happened, leave the VPN up: qBittorrent and every site behind the proxy need it.
  try {
    if (JSON.parse(await gluetun('/v1/vpn/status')).status !== 'running') await gluetun('/v1/vpn/status', 'PUT', { status: 'running' })
  } catch (e) {
    report.push(`Could not check the VPN is up: ${e.message}`)
  }
  report.push(ok ? 'AudioBook Bay works again.' : 'AudioBook Bay failed in every region tried.')
  return report.join('\n')
}

/** Everything the agent may change. Each checks its arguments before anything is sent. */
export const FIXES = {
  retry: {
    usage: 'retry <radarr|sonarr> <queueId...>: blocklist the release, remove it from qBittorrent and grab another',
    run: (app, ...q) => arr(arrApp(app), '/queue/bulk?removeFromClient=true&blocklist=true&skipRedownload=false', 'DELETE', { ids: ids(q) }),
  },
  search: {
    usage: 'search <radarr|sonarr> <movieId...|episodeId...>: search the indexers again',
    run: (app, ...list) =>
      arrApp(app) === 'radarr'
        ? arr('radarr', '/command', 'POST', { name: 'MoviesSearch', movieIds: ids(list) })
        : arr('sonarr', '/command', 'POST', { name: 'EpisodeSearch', episodeIds: ids(list) }),
  },
  'test-indexers': {
    usage: 'test-indexers: have Prowlarr test every indexer (re-enables ones that work again)',
    run: () => arr('prowlarr', '/indexer/testall', 'POST'),
  },
  restart: {
    usage: 'restart <radarr|sonarr|prowlarr>: restart the app',
    run: (app) => {
      if (!(app in APPS)) throw new Error('app must be radarr, sonarr or prowlarr')
      return arr(app, '/system/restart', 'POST')
    },
  },
  recheck: { usage: 'recheck <hash>: have qBittorrent recheck a torrent’s files', run: (h) => qbit('/torrents/recheck', new URLSearchParams({ hashes: hash(h) })) },
  resume: { usage: 'resume <hash>: start a paused or stopped torrent', run: (h) => qbit('/torrents/start', new URLSearchParams({ hashes: hash(h) })) },
  'reconnect-vpn': {
    usage: 'reconnect-vpn: move the VPN to other regions until AudioBook Bay answers (up to 4 tries; can take 10 minutes)',
    run: () => reconnectVpn(),
  },
  'edition-search': {
    usage: 'edition-search <id>: search again for a waiting Edition, e.g. edition-search "OL27513W~andy serkis"',
    run: (...words) => arrmy(`/editions/${encodeURIComponent(editionId(words))}/search`, 'POST'),
  },
}

/** Reads one API path. GET only, so it can't change anything. Long answers are cut so they fit the agent's context. */
async function get(app, path) {
  if (!path?.startsWith('/')) throw new Error('path must start with /')
  let text
  if (app === 'qbittorrent') text = await qbit(path)
  else if (app in APPS) text = await arr(app, path)
  else if (app === 'gluetun') {
    // Only these two: its settings hold the VPN login.
    if (path !== '/v1/publicip/ip' && path !== '/v1/vpn/status') throw new Error('gluetun paths: /v1/publicip/ip, /v1/vpn/status')
    text = await gluetun(path)
  } else if (app === 'arrmy') {
    if (path !== '/editions' && !path.startsWith('/abb?s=')) throw new Error('arrmy paths: /editions, /abb?s=<words>')
    text = await arrmy(path)
  } else throw new Error('app must be radarr, sonarr, prowlarr, qbittorrent, gluetun or arrmy')
  return text.length > 30_000 ? `${text.slice(0, 30_000)}\n… cut at 30,000 characters: ask for less (pageSize, a filter)` : text
}

/**
 * Whether to look into a Problem now: once a day per Problem, and at most `cap` a day in all, so one broken indexer
 * can't use up the subscription. Counts it when it says 'ok'.
 */
export function admit(state, key, now, cap) {
  const day = new Date(now).toISOString().slice(0, 10)
  if (state.day !== day) Object.assign(state, { day, count: 0 })
  if (now - (state.seen.get(key) ?? -Infinity) < DAY) return 'seen'
  if (state.count >= cap) return 'cap'
  state.seen.set(key, now)
  state.count++
  return 'ok'
}

const tool = `node ${SELF}`
export const prompt = (p) => `You look after the Arrmy stack: Arrmy (a Request app for movies, TV and audiobooks) in front of Radarr, Sonarr,
Prowlarr, qBittorrent (behind a VPN) and LazyLibrarian. Arrmy just raised this Problem:

${JSON.stringify(p, null, 2)}

ids are Radarr/Sonarr queue ids for "retry", movie or episode ids for "search".

Find the cause. Read anything with \`${tool} get <app> <path>\`:
- radarr, sonarr, prowlarr take their API paths without /api/vN, e.g. \`get radarr /queue?includeMovie=true\`,
  \`get sonarr /history?pageSize=20&sortKey=date&sortDirection=descending\`, \`get prowlarr /indexerstatus\`,
  \`get radarr /log?pageSize=50&sortKey=time&sortDirection=descending\`, \`get radarr /health\`
- qbittorrent takes its /api/v2 paths, e.g. \`get qbittorrent /torrents/info\`, \`get qbittorrent /log/main\`
- gluetun (the VPN): \`get gluetun /v1/publicip/ip\`, \`get gluetun /v1/vpn/status\`
- arrmy: \`get arrmy /editions\` lists the audiobook Editions still waiting and what their last search found (abb is
  how many AudioBook Bay results, or 'failed'); \`get arrmy /abb?s=<words>\` searches AudioBook Bay through the VPN now

A Problem with service 'editions' is an Edition whose search found nothing. Check \`get arrmy /editions\` and
\`get arrmy /abb?s=<title> <narrator>\` and \`get arrmy /abb?s=<series> <narrator>\`. Arrmy uses a narrator's
whole-series upload too ("The Lord of the Rings - Narrated by Andy Serkis"): it downloads only this book's files, and
counts it under packs. So if AudioBook Bay lists a single or series upload by this narrator but the Edition's search
shows singles 0 and packs 0, or abbError says searches failed, Arrmy's AudioBook Bay requests failed during that search.
That is not "nothing to find". If AudioBook Bay fails or drops requests through the VPN while other sites work, this
VPN region is the cause: run \`fix reconnect-vpn\` (give the command a 10-minute timeout), then
\`fix edition-search <id>\`. If AudioBook Bay works now, just run \`fix edition-search <id>\`.

Fix it only when you're sure, and only with \`${tool} fix <name> <args...>\`:
${Object.values(FIXES)
  .map((f) => `- ${f.usage}`)
  .join('\n')}
Nothing else can change anything, so don't try. Some things only the Admin can fix (an indexer's login, disk space, the VPN login,
a setting): say exactly what to do and where.

Answer in under 1500 characters of Discord markdown, in plain words, with three parts: **Cause**, **What I did** (or
"Nothing"), **What you need to do** (or "Nothing").

Then a last line of exactly \`Solved: yes\` or \`Solved: no\`. Yes only if you checked that the Problem's cause is gone
now (a new release is downloading, the indexer answers again…), not just that a fix ran.`

/** A Bash command the agent ran, as a step for Discord: Checked for each `get`, Fixed for each `fix`. */
export function stepOf(command) {
  const m = /\bdoctor\.mjs['"]?\s+(get|fix)\s+(.+)/s.exec(command ?? '')
  return m ? { step: m[1] === 'get' ? 'Checked' : 'Fixed', text: m[2].trim().replace(/\s+/g, ' ').slice(0, 200) } : undefined
}

/** The answer without its last "Solved: yes|no" line, and whether it said yes. No such line counts as not solved. */
export function verdict(text) {
  const m = /\n?[*_\s]*Solved:?[*_\s]*(yes|no)\b[*_.\s]*$/i.exec(text)
  return { answer: (m ? text.slice(0, m.index) : text).trim(), solved: m?.[1].toLowerCase() === 'yes' }
}

/**
 * Runs the agent on one Problem, calling `emit` with each get or fix once its result is back (failed when it errored),
 * and returns its answer and whether it solved the Problem.
 */
function investigate(problem, emit) {
  return new Promise((resolve, reject) => {
    // stream-json needs --verbose with -p; it writes one JSON event per line.
    const child = spawn(CLAUDE, ['-p', '--output-format', 'stream-json', '--verbose', '--max-turns', '40'], { cwd: `${HOME}/work`, timeout: 20 * 60_000 })
    const pending = new Map() // tool_use id → its step, until its result arrives
    let result
    let rest = ''
    const line = (l) => {
      let e
      try {
        e = JSON.parse(l)
      } catch {
        return // not an event
      }
      for (const c of e.message?.content ?? []) {
        if (e.type === 'assistant' && c.type === 'tool_use' && c.name === 'Bash') {
          const s = stepOf(c.input?.command)
          if (s) pending.set(c.id, s)
        } else if (e.type === 'user' && c.type === 'tool_result' && pending.has(c.tool_use_id)) {
          emit({ ...pending.get(c.tool_use_id), ...(c.is_error && { failed: true }) })
          pending.delete(c.tool_use_id)
        }
      }
      if (e.type === 'result') result = e
    }
    child.stdout.setEncoding('utf8').on('data', (c) => {
      const lines = (rest + c).split('\n')
      rest = lines.pop()
      lines.forEach(line)
    })
    child.stderr.on('data', (c) => process.stderr.write(c))
    child.on('error', reject)
    child.on('close', (code) => {
      line(rest)
      if (result && !result.is_error && result.subtype === 'success') resolve(verdict(result.result ?? ''))
      else reject(new Error(`claude exited ${code}: ${result?.result || result?.subtype || 'no result'}`))
    })
    child.stdin.end(prompt(problem))
  })
}

function serve() {
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    console.log('[doctor] no CLAUDE_CODE_OAUTH_TOKEN set, so nothing to do. README → The doctor sets it up.')
    return
  }
  if (SECRET.length < 16) throw new Error('SESSION_SECRET is missing or shorter than 16 characters')
  const expected = Buffer.from(`Bearer ${doctorToken()}`)
  const cap = Number(process.env.DOCTOR_DAILY ?? 10)

  // Fresh each start: the CLI updates often, and its own updater can't write to the image.
  mkdirSync(`${HOME}/work`, { recursive: true })
  try {
    execFileSync('npm', ['install', '--prefix', `${HOME}/cli`, '--no-audit', '--no-fund', '@anthropic-ai/claude-code@latest'], { stdio: 'inherit' })
  } catch {
    console.warn('[doctor] updating Claude Code failed; using the copy already installed, if any')
  }
  // The agent's only ways to change anything. Read, Grep and Glob stay: they need no permission and change nothing.
  mkdirSync(`${HOME}/.claude`, { recursive: true })
  writeFileSync(
    `${HOME}/.claude/settings.json`,
    // reconnect-vpn takes minutes; the Bash tool would stop it after 2.
    JSON.stringify({ env: { BASH_DEFAULT_TIMEOUT_MS: '600000' }, permissions: { allow: [`Bash(${tool} get:*)`, `Bash(${tool} fix:*)`], deny: ['Write', 'Edit', 'NotebookEdit', 'WebFetch', 'WebSearch'] } }, null, 2),
  )

  // shortcut: kept in memory, so a restart forgets which Problems were looked into today; persist it if that costs too much.
  const state = { day: '', count: 0, seen: new Map() }
  let queue = Promise.resolve()
  createServer((req, res) => {
    const auth = Buffer.from(req.headers.authorization ?? '')
    if (req.method !== 'POST' || req.url !== '/investigate') return res.writeHead(404).end()
    if (auth.length !== expected.length || !timingSafeEqual(auth, expected)) return res.writeHead(403).end()
    let body = ''
    req.on('data', (c) => (body += c)).on('end', () => {
      let key, problem
      try {
        ;({ key, problem } = JSON.parse(body))
        if (typeof key !== 'string' || !problem) throw new Error()
      } catch {
        return res.writeHead(400).end('expected {key, problem}')
      }
      const verdict = admit(state, key, Date.now(), cap)
      if (verdict !== 'ok') {
        console.log(`[doctor] ${key}: skipped (${verdict === 'seen' ? 'looked into today already' : `${cap} today already`})`)
        return res.writeHead(204).end()
      }
      console.log(`[doctor] ${key}: looking into it`)
      // One at a time: the subscription's limits are shared with the Admin's own use. The 200 goes out when the run
      // starts, then one JSON line per step and a last one with the answer or the error (doctor.ts reads them).
      queue = queue.then(() => {
        res.writeHead(200, { 'Content-Type': 'application/x-ndjson' })
        const send = (event) => res.write(`${JSON.stringify(event)}\n`)
        return investigate(problem, send).then(
          (r) => res.end(`${JSON.stringify(r)}\n`),
          (e) => {
            console.warn(`[doctor] ${key}: ${e.message}`)
            res.end(`${JSON.stringify({ error: e.message })}\n`)
          },
        )
      })
    })
  }).listen(3002, () => console.log(`[doctor] ready, at most ${cap} Problems a day`))
}

if (process.argv[1] === SELF) {
  const [cmd, name, ...args] = process.argv.slice(2)
  if (!cmd) serve()
  else
    Promise.resolve()
      .then(() => {
        if (cmd === 'get') return get(name, args[0])
        if (cmd === 'fix' && FIXES[name]) return FIXES[name].run(...args)
        throw new Error(`usage: get <app> <path> | fix <${Object.keys(FIXES).join('|')}> …`)
      })
      .then((out) => console.log(out || 'done'))
      .catch((e) => {
        console.error(e.message)
        process.exitCode = 1
      })
}
