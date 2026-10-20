// One-shot setup the Stack needs before qBittorrent and Arrmy start (the `init` service, run as root):
// the TRaSH /data folders, Arrmy's config folder and qBittorrent's login. Safe to re-run; never overwrites.
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { chownSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'

const [data = '/data', config = '/config'] = process.argv.slice(2)
const { PUID, PGID, QBIT_PASSWORD } = process.env
if (!PUID || !PGID || !QBIT_PASSWORD) throw new Error('PUID, PGID and QBIT_PASSWORD must be set')

function own(path) {
  try {
    chownSync(path, Number(PUID), Number(PGID))
  } catch (e) {
    console.warn(`[init] could not hand ${path} to ${PUID}:${PGID}: ${e.message}`) // e.g. an NFS share with root squash
  }
}

// TRaSH-guide layout: downloads and media share one /data tree, so imports are instant hardlinks, not copies.
for (const dir of ['torrents/movies', 'torrents/tv', 'media/movies', 'media/tv', 'media/audiobooks', 'media/podcasts', 'media/books']) {
  const [parent] = dir.split('/')
  mkdirSync(`${data}/${dir}`, { recursive: true })
  own(`${data}/${parent}`)
  own(`${data}/${dir}`)
}
for (const dir of ['arrmy', 'qbittorrent/qBittorrent', 'audiobookshelf/config', 'audiobookshelf/metadata']) {
  mkdirSync(`${config}/${dir}`, { recursive: true })
  own(`${config}/${dir}`)
}

const conf = `${config}/qbittorrent/qBittorrent/qBittorrent.conf`
if (!existsSync(conf)) {
  // qBittorrent only accepts a PBKDF2-SHA512 hash (16-byte salt, 100k rounds).
  const salt = randomBytes(16)
  const hash = pbkdf2Sync(QBIT_PASSWORD, salt, 100000, 64, 'sha512')
  const lines = [
    '[LegalNotice]',
    'Accepted=true',
    '',
    '[BitTorrent]',
    'Session\\DefaultSavePath=/data/torrents',
    'Session\\DisableAutoTMMByDefault=false',
    'Session\\QueueingSystemEnabled=false', // seed and download everything at once, not a few at a time
    '',
    '[Preferences]',
    'WebUI\\Port=8080',
    'WebUI\\LocalHostAuth=false', // only gluetun shares qBittorrent's localhost; it sets the forwarded port
    'WebUI\\HostHeaderValidation=false', // else it refuses the browser, whose port (QBIT_PORT) differs from 8080 inside Docker
    'WebUI\\Username=admin',
    `WebUI\\Password_PBKDF2="@ByteArray(${salt.toString('base64')}:${hash.toString('base64')})"`,
  ]
  writeFileSync(conf, `${lines.join('\n')}\n`)
  own(conf)
}
console.log('[init] folders and qBittorrent login ready')
