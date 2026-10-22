import assert from 'node:assert/strict'
import { test } from 'node:test'
import { admit, FIXES, prompt } from '../scripts/doctor.mjs'

const HOUR = 3_600_000

test('admit: once a day per Problem, and a daily cap across all of them', () => {
  const state = { day: '', count: 0, seen: new Map() }
  const t = Date.parse('2026-10-22T08:00:00Z')
  assert.equal(admit(state, 'a', t, 2), 'ok')
  assert.equal(admit(state, 'a', t + HOUR, 2), 'seen')
  assert.equal(admit(state, 'b', t, 2), 'ok')
  assert.equal(admit(state, 'c', t, 2), 'cap')
  // A new day resets the cap; 'a' is looked into again once 24 hours have passed.
  assert.equal(admit(state, 'c', t + 16 * HOUR, 2), 'ok')
  assert.equal(admit(state, 'a', t + 24 * HOUR, 2), 'ok')
})

test('fixes refuse bad arguments before sending anything', async () => {
  await assert.rejects(async () => FIXES.retry.run('prowlarr', '1'), /radarr or sonarr/)
  await assert.rejects(async () => FIXES.search.run('radarr', '1; rm -rf /'), /positive whole numbers/)
  await assert.rejects(async () => FIXES.search.run('sonarr'), /positive whole numbers/)
  await assert.rejects(async () => FIXES.restart.run('qbittorrent'), /radarr, sonarr or prowlarr/)
  await assert.rejects(async () => FIXES.recheck.run('../torrents/delete'), /40-character/)
})

test('the prompt lists every fix and the Problem', () => {
  const text = prompt({ kind: 'Missing', title: 'Dune (2021)' })
  for (const f of Object.values(FIXES) as { usage: string }[]) assert.ok(text.includes(f.usage))
  assert.ok(text.includes('Dune (2021)'))
})
