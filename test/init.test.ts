import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { existsSync } from 'node:fs'
import { audiobookBayToken, lazyLibrarianKey, tautulliKey } from '../src/lib/token.ts'
import { gluetunKey } from '../scripts/doctor.mjs'

const run = (data: string, config: string) =>
  spawnSync(process.execPath, ['scripts/init.mjs', data, config], {
    env: { ...process.env, PUID: '1000', PGID: '1000', QBIT_PASSWORD: 'qbit-pass', SESSION_SECRET: 'a-test-secret-of-32-characters!!' },
    encoding: 'utf8',
  })

test('init gives LazyLibrarian the API key Arrmy derives, and never overwrites its settings', () => {
  const root = mkdtempSync(join(tmpdir(), 'arrmy-init-'))
  try {
    const [data, config] = [join(root, 'data'), join(root, 'config')]
    assert.equal(run(data, config).status, 0)

    const ini = readFileSync(join(config, 'lazylibrarian', 'config.ini'), 'utf8')
    assert.match(ini, new RegExp(`^api_key = ${lazyLibrarianKey('a-test-secret-of-32-characters!!')}$`, 'm'))
    const relay = `abb_host = http://arrmy:3001/abb/${audiobookBayToken('a-test-secret-of-32-characters!!')}`
    assert.ok(ini.split('\n').includes(relay), 'AudioBook Bay through the relay, with the token Arrmy checks')
    for (const line of ['api_enabled = 1', 'ol_api = 1', 'audio_dir = /data/media/audiobooks', 'qbittorrent_host = gluetun', 'keep_seeding = 1', 'reject_minaudio = 50'])
      assert.match(ini, new RegExp(`^${line}$`, 'm'), line)
    assert.doesNotMatch(ini, /= True$/m, 'LazyLibrarian reads True as off')

    writeFileSync(join(config, 'lazylibrarian', 'config.ini'), '[API]\napi_key = changed-by-user\n')
    assert.equal(run(data, config).status, 0)
    assert.equal(readFileSync(join(config, 'lazylibrarian', 'config.ini'), 'utf8'), '[API]\napi_key = changed-by-user\n')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('init gives Tautulli the API key Arrmy derives and Plex\'s address, once', () => {
  const root = mkdtempSync(join(tmpdir(), 'arrmy-init-'))
  try {
    const [data, config] = [join(root, 'data'), join(root, 'config')]
    assert.equal(run(data, config).status, 0)
    const ini = readFileSync(join(config, 'tautulli', 'config.ini'), 'utf8')
    const key = tautulliKey('a-test-secret-of-32-characters!!')
    assert.equal(key.length, 32, 'Tautulli refuses any other length')
    for (const line of [`api_key = ${key}`, 'api_enabled = 1', 'pms_ip = plex', 'pms_port = 32400']) assert.match(ini, new RegExp(`^${line}$`, 'm'), line)

    writeFileSync(join(config, 'tautulli', 'config.ini'), '[General]\napi_key = set-by-tautulli\n')
    assert.equal(run(data, config).status, 0)
    assert.equal(readFileSync(join(config, 'tautulli', 'config.ini'), 'utf8'), '[General]\napi_key = set-by-tautulli\n')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('init makes the folders autobrr and Tdarr keep their settings in', () => {
  const root = mkdtempSync(join(tmpdir(), 'arrmy-init-'))
  try {
    const [data, config] = [join(root, 'data'), join(root, 'config')]
    assert.equal(run(data, config).status, 0)
    for (const dir of ['autobrr', 'tdarr/server', 'tdarr/configs', 'tdarr/logs', 'tdarr/temp']) assert.ok(existsSync(join(config, dir)), dir)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('init gives gluetun the doctor\'s key, keeps it in step, and leaves a file the user wrote', () => {
  const root = mkdtempSync(join(tmpdir(), 'arrmy-init-'))
  try {
    const [data, config] = [join(root, 'data'), join(root, 'config')]
    const file = join(config, 'gluetun', 'auth', 'config.toml')
    assert.equal(run(data, config).status, 0)
    const toml = readFileSync(file, 'utf8')
    assert.match(toml, new RegExp(`^apikey = "${gluetunKey('a-test-secret-of-32-characters!!')}"$`, 'm'))
    assert.match(toml, /^auth = "apikey"$/m)
    assert.doesNotMatch(toml, /GET \/v1\/vpn\/settings/, 'its settings show the VPN login')

    writeFileSync(file, toml.replace(/apikey = ".*"/, 'apikey = "old"'))
    assert.equal(run(data, config).status, 0)
    assert.equal(readFileSync(file, 'utf8'), toml, 'Arrmy\'s own file is rewritten')

    writeFileSync(file, '[[roles]]\nname = "mine"\n')
    assert.equal(run(data, config).status, 0)
    assert.equal(readFileSync(file, 'utf8'), '[[roles]]\nname = "mine"\n')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
