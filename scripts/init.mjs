// One-shot setup the Stack needs before qBittorrent and Arrmy start (the `init` service, run as root):
// the TRaSH /data folders, Arrmy's config folder, qBittorrent's login, and LazyLibrarian's and Tautulli's settings, and the folders autobrr and Tdarr keep theirs in. Safe to re-run;
// never overwrites.
import { createHmac, pbkdf2Sync, randomBytes } from 'node:crypto'
import { chownSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'

const [data = '/data', config = '/config'] = process.argv.slice(2)
const { PUID, PGID, QBIT_PASSWORD, SESSION_SECRET } = process.env
if (!PUID || !PGID || !QBIT_PASSWORD || !SESSION_SECRET) throw new Error('PUID, PGID, QBIT_PASSWORD and SESSION_SECRET must be set')

function own(path) {
  try {
    chownSync(path, Number(PUID), Number(PGID))
  } catch (e) {
    console.warn(`[init] could not hand ${path} to ${PUID}:${PGID}: ${e.message}`) // e.g. an NFS share with root squash
  }
}

// TRaSH-guide layout: downloads and media share one /data tree, so imports are instant hardlinks, not copies.
for (const dir of ['torrents/movies', 'torrents/tv', 'torrents/books', 'media/movies', 'media/tv', 'media/audiobooks', 'media/podcasts', 'media/books']) {
  const [parent] = dir.split('/')
  mkdirSync(`${data}/${dir}`, { recursive: true })
  own(`${data}/${parent}`)
  own(`${data}/${dir}`)
}
for (const dir of ['arrmy', 'qbittorrent/qBittorrent', 'audiobookshelf/config', 'audiobookshelf/metadata', 'lazylibrarian', 'tautulli', 'autobrr', 'tdarr/server', 'tdarr/configs', 'tdarr/logs', 'tdarr/temp', 'kometa', 'doctor']) {
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

const books = `${config}/lazylibrarian/config.ini`
if (!existsSync(books)) {
  // LazyLibrarian reads on/off settings as numbers: 1, never True. Its API key is the one Arrmy derives
  // (src/lib/token.ts lazyLibrarianKey); keep the two in sync.
  const apiKey = createHmac('sha256', SESSION_SECRET).update('lazylibrarian').digest('hex').slice(0, 32)
  const lines = [
    '[API]',
    'api_enabled = 1',
    `api_key = ${apiKey}`,
    'ol_api = 1', // OpenLibrary, the default book search, is off until switched on
    '',
    '[WebServer]',
    'http_user = admin',
    `http_pass = ${QBIT_PASSWORD}`,
    '',
    '[General]',
    'ebook_dir = /data/media/books',
    'audio_dir = /data/media/audiobooks', // the same folder Audiobookshelf watches
    'download_dir = /data/torrents/books',
    '',
    '[TORRENT]',
    'tor_downloader_qbittorrent = 1',
    'keep_seeding = 1', // LazyLibrarian can't hardlink, so it copies the finished book and the torrent keeps seeding
    '',
    '[QBITTORRENT]',
    'qbittorrent_host = gluetun',
    'qbittorrent_port = 8080',
    'qbittorrent_user = admin',
    `qbittorrent_pass = ${QBIT_PASSWORD}`,
    'qbittorrent_label = books',
    '',
    '[PostProcess]',
    'audiobook_dest_folder = $Author/$Title',
    '',
    // Audiobook results under 50 MB are skipped: they're ebooks posted as audiobooks. LazyLibrarian files the setting here.
    '[MAGAZINES]',
    'reject_minaudio = 50',
    '',
    // AudioBook Bay through Arrmy's relay (src/lib/abbrelay.ts relayAddress), with the key audiobookBayToken derives
    '[ABB]',
    'abb = 1',
    `abb_host = http://arrmy:3001/abb/${createHmac('sha256', SESSION_SECRET).update('audiobookbay').digest('base64url')}`,
  ]
  writeFileSync(books, `${lines.join('\n')}\n`)
  own(books)
}
const watch = `${config}/tautulli/config.ini`
if (!existsSync(watch)) {
  // Its API key is the one Arrmy derives (src/lib/token.ts tautulliKey). Tautulli keeps a key it finds, and its
  // first-run wizard only asks for the Plex sign-in, with Plex's address already filled in.
  const lines = [
    '[General]',
    'api_enabled = 1',
    `api_key = ${createHmac('sha256', SESSION_SECRET).update('tautulli').digest('hex').slice(0, 32)}`,
    '',
    '[PMS]',
    'pms_ip = plex',
    'pms_port = 32400',
  ]
  writeFileSync(watch, `${lines.join('\n')}\n`)
  own(watch)
}
console.log('[init] folders, qBittorrent login, LazyLibrarian and Tautulli settings ready')
