// The doctor: when Arrmy announces a Problem, a Claude Code agent looks into it, and Arrmy posts what it found to #problems.
// It runs on the Admin's Claude subscription (CLAUDE_CODE_OAUTH_TOKEN, from `claude setup-token`). The agent can read every
// app's API, but can only change things through the safe fixes in FIXES: no shell, no file edits, no Docker.
//   node doctor.mjs                       the server Arrmy posts Problems to (port 3002, inside Docker only)
//   node doctor.mjs get <app> <path>      how the agent reads an API
//   node doctor.mjs fix <name> <args...>  how the agent fixes something
import { execFileSync, spawn } from 'node:child_process'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

const SELF = fileURLToPath(import.meta.url)
const HOME = process.env.HOME ?? '/config'
const CLAUDE = `${HOME}/cli/node_modules/.bin/claude`
const QBIT_URL = process.env.QBIT_URL ?? 'http://gluetun:8080'
const APPS = {
  radarr: { url: process.env.RADARR_URL ?? 'http://radarr:7878', key: process.env.RADARR_API_KEY, api: 'v3' },
  sonarr: { url: process.env.SONARR_URL ?? 'http://sonarr:8989', key: process.env.SONARR_API_KEY, api: 'v3' },
  prowlarr: { url: process.env.PROWLARR_URL ?? 'http://prowlarr:9696', key: process.env.PROWLARR_API_KEY, api: 'v1' },
}
const DAY = 24 * 3_600_000

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
}

/** Reads one API path. GET only, so it can't change anything. Long answers are cut so they fit the agent's context. */
async function get(app, path) {
  if (!path?.startsWith('/')) throw new Error('path must start with /')
  const text = app === 'qbittorrent' ? await qbit(path) : app in APPS ? await arr(app, path) : undefined
  if (text === undefined) throw new Error('app must be radarr, sonarr, prowlarr or qbittorrent')
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

Fix it only when you're sure, and only with \`${tool} fix <name> <args...>\`:
${Object.values(FIXES)
  .map((f) => `- ${f.usage}`)
  .join('\n')}
Nothing else can change anything, so don't try. Some things only the Admin can fix (an indexer's login, disk space, the VPN,
a setting): say exactly what to do and where.

Answer in under 1500 characters of Discord markdown, in plain words, with three parts: **Cause**, **What I did** (or
"Nothing"), **What you need to do** (or "Nothing").`

/** Runs the agent on one Problem and returns its answer. */
function investigate(problem) {
  return new Promise((resolve, reject) => {
    const child = spawn(CLAUDE, ['-p', '--output-format', 'json', '--max-turns', '40'], { cwd: `${HOME}/work`, timeout: 20 * 60_000 })
    let out = ''
    child.stdout.on('data', (c) => (out += c))
    child.stderr.on('data', (c) => process.stderr.write(c))
    child.on('error', reject)
    child.on('close', (code) => {
      try {
        const r = JSON.parse(out)
        if (r.is_error || r.subtype !== 'success') throw new Error(r.result || r.subtype)
        resolve(r.result)
      } catch (e) {
        reject(new Error(`claude exited ${code}: ${e.message}`))
      }
    })
    child.stdin.end(prompt(problem))
  })
}

function serve() {
  if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    console.log('[doctor] no CLAUDE_CODE_OAUTH_TOKEN set, so nothing to do. README → The doctor sets it up.')
    return
  }
  const secret = process.env.SESSION_SECRET ?? ''
  if (secret.length < 16) throw new Error('SESSION_SECRET is missing or shorter than 16 characters')
  // token.ts doctorToken derives the same.
  const expected = Buffer.from(`Bearer ${createHmac('sha256', secret).update('doctor').digest('base64url')}`)
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
    JSON.stringify({ permissions: { allow: [`Bash(${tool} get:*)`, `Bash(${tool} fix:*)`], deny: ['Write', 'Edit', 'NotebookEdit', 'WebFetch', 'WebSearch'] } }, null, 2),
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
      // One at a time: the subscription's limits are shared with the Admin's own use.
      queue = queue.then(() =>
        investigate(problem).then(
          (answer) => res.writeHead(200, { 'Content-Type': 'text/plain' }).end(answer),
          (e) => {
            console.warn(`[doctor] ${key}: ${e.message}`)
            res.writeHead(502).end(e.message)
          },
        ),
      )
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
