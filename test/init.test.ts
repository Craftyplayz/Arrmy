import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { lazyLibrarianKey } from '../src/lib/token.ts'

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
    for (const line of ['api_enabled = 1', 'ol_api = 1', 'audio_dir = /data/media/audiobooks', 'qbittorrent_host = gluetun', 'keep_seeding = 1'])
      assert.match(ini, new RegExp(`^${line}$`, 'm'), line)
    assert.doesNotMatch(ini, /= True$/m, 'LazyLibrarian reads True as off')

    writeFileSync(join(config, 'lazylibrarian', 'config.ini'), '[API]\napi_key = changed-by-user\n')
    assert.equal(run(data, config).status, 0)
    assert.equal(readFileSync(join(config, 'lazylibrarian', 'config.ini'), 'utf8'), '[API]\napi_key = changed-by-user\n')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
