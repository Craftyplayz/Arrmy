import assert from 'node:assert/strict'
import { test } from 'node:test'
import { admit, FIXES, nextRegion, prompt, stepOf, verdict } from '../scripts/doctor.mjs'

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

test('nextRegion: where AudioBook Bay worked first, then untried regions, then the oldest failure', () => {
  const history = {
    Riga: { failed: 5 },
    Montreal: { ok: 3 },
    Toronto: { ok: 4, failed: 6 },
    Berlin: { failed: 2 },
    Paris: { ok: 1 },
  }
  const all = ['Riga', 'Montreal', 'Toronto', 'Berlin', 'Paris', 'Oslo', 'Rome']
  const first = (list: string[]) => list[0]
  assert.equal(nextRegion(history, all, [], first), 'Montreal')
  assert.equal(nextRegion(history, all, ['Montreal'], first), 'Paris')
  assert.equal(nextRegion(history, all, ['Montreal', 'Paris'], first), 'Oslo')
  assert.equal(nextRegion(history, all, ['Montreal', 'Paris', 'Oslo', 'Rome'], first), 'Berlin')
  assert.equal(nextRegion(history, all, ['Montreal', 'Paris', 'Oslo', 'Rome', 'Berlin', 'Riga'], first), 'Toronto')
  assert.equal(nextRegion(history, all, all, first), null)
  assert.equal(nextRegion({}, [], []), null)
})

test('edition-search refuses anything but an Edition id', async () => {
  await assert.rejects(async () => FIXES['edition-search'].run('OL1W~x/../../admin'), /Edition id/)
  await assert.rejects(async () => FIXES['edition-search'].run('x'.repeat(121)), /Edition id/)
  await assert.rejects(async () => FIXES['edition-search'].run(), /Edition id/)
})

test('stepOf: a get is Checked, a fix is Fixed, anything else is no step', () => {
  assert.deepEqual(stepOf('node /app/doctor.mjs get radarr /queue?includeMovie=true'), { step: 'Checked', text: 'radarr /queue?includeMovie=true' })
  assert.deepEqual(stepOf('node /app/doctor.mjs fix retry radarr 412'), { step: 'Fixed', text: 'retry radarr 412' })
  assert.deepEqual(stepOf('node "/app/doctor.mjs" fix edition-search "OL27513W~andy serkis"'), { step: 'Fixed', text: 'edition-search "OL27513W~andy serkis"' })
  assert.equal(stepOf('ls /config'), undefined)
  assert.equal(stepOf(undefined), undefined)
})

test('verdict: the last Solved line says whether it worked, and is cut from the answer', () => {
  assert.deepEqual(verdict('**Cause** x\n**What I did** y\n\nSolved: yes'), { answer: '**Cause** x\n**What I did** y', solved: true })
  assert.deepEqual(verdict('**Cause** x\n**Solved:** No.'), { answer: '**Cause** x', solved: false })
  assert.deepEqual(verdict('**Cause** x'), { answer: '**Cause** x', solved: false })
  // Only a last line counts.
  assert.equal(verdict('Solved: yes, then it broke again\nSolved: no').solved, false)
})
