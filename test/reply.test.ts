import assert from 'node:assert/strict'
import { test } from 'node:test'
import { admitReply, FIXES, REPLY_FIXES, replyPrompt } from '../scripts/doctor.mjs'
import {
  byId,
  confirmButtons,
  contentHidden,
  escape,
  laterMinutes,
  listCards,
  listFile,
  listIntro,
  meanwhile,
  newMessages,
  numbered,
  otherQuality,
  parseButton,
  releaseLine,
  replyable,
  replyText,
  type Found,
  type Message,
} from '../src/lib/replyrules.ts'

const found = (title: string, f: Partial<Found> = {}): Found => ({ title, size: 4.2e9, source: 'YTS', rejections: [], grab: { app: 'radarr', guid: title, indexerId: 1 }, ...f })

test('the list: acceptable first, then turned down, then dead; most seeders first within each', () => {
  const list = numbered([
    found('dead', { seeders: 900, dead: true }),
    found('rejected', { seeders: 500, rejections: ['Too big'] }),
    found('few', { seeders: 3 }),
    found('unknown'),
    found('many', { seeders: 120 }),
  ])
  assert.deepEqual(
    list.map((r) => [r.n, r.title]),
    [
      [1, 'many'],
      [2, 'few'],
      [3, 'unknown'],
      [4, 'rejected'],
      [5, 'dead'],
    ],
  )
})

test('a line has the number, the name with Discord markdown escaped, the facts and why it was turned down', () => {
  const [r] = numbered([found('Dune_Part_Two*2024', { seeders: 1, quality: 'Bluray-1080p', rejections: ['Too big', 'Too big'] })])
  assert.equal(releaseLine(r), '**1.** Dune\\_Part\\_Two\\*2024 · 4.2 GB · 1 seeder · YTS · Bluray-1080p · *turned down: Too big*')
  assert.equal(escape('a|b>c`d'), 'a\\|b\\>c\\`d')
  const [abb] = numbered([found('Book', { size: 0, source: 'AudioBook Bay', dead: true })])
  assert.ok(releaseLine(abb).includes('size unknown · AudioBook Bay · *tried already, never started*'))
})

test('cards hold as many lines as fit, only the first 200, and the file has every release', () => {
  const list = numbered(Array.from({ length: 250 }, (_, i) => found(`Release.${i}.${'x'.repeat(80)}`, { seeders: 250 - i })))
  const cards = listCards(list)
  assert.ok(cards.every((c) => c.length <= 3900))
  const lines = cards.join('\n').split('\n')
  assert.equal(lines.length, 200)
  assert.ok(lines[0].startsWith('**1.** Release.0.'))
  assert.ok(lines.at(-1)!.startsWith('**200.** '))
  const file = listFile({ at: Date.parse('2026-10-23T22:15:00Z'), title: 'Dune (2021)', entries: list })
  assert.ok(file.startsWith('Every release found for Dune (2021), 2026-10-23 22:15 UTC\n\n1. Release.0.'))
  assert.ok(file.includes('\n250. Release.249.'))
  assert.ok(file.endsWith('\n'))
  assert.match(listIntro({ at: 0, title: 'Dune (2021)', entries: list }, 200), /^250 releases found for Dune \(2021\), 250 acceptable\. The first 200 are below; the attached file has all 250\./)
})

test('a short list still gets its file, and an empty one says nothing was found', () => {
  const list = numbered([found('Only.One', { seeders: 2 })])
  assert.match(listIntro({ at: 0, title: 'Dune', entries: list }, 1), /1 release found for Dune, 1 acceptable\. They are below and in the attached file\./)
  assert.ok(listFile({ at: 0, title: 'Dune', entries: list }).includes('1. Only.One'))
  assert.equal(listIntro({ at: 0, title: 'Dune', entries: [] }, 0), 'The search found no releases for Dune.')
  assert.ok(listFile({ at: 0, title: 'Dune', entries: [] }).includes('Nothing found.'))
})

const msg = (id: string, author: string, content: string, secondsAgo: number, extra: Partial<Message> = {}): Message => ({
  id,
  author: { id: author },
  content,
  timestamp: new Date(Date.parse('2026-10-23T22:00:00Z') - secondsAgo * 1000).toISOString(),
  ...extra,
})
const NOW = Date.parse('2026-10-23T22:00:00Z')

test("replies: only the Admin's messages, oldest first, once they've stopped typing; everyone else is skipped", () => {
  const messages = [msg('1300000000000000003', 'admin', 'the 4 GB one', 25), msg('1300000000000000001', 'admin', 'download', 40), msg('1300000000000000002', 'mum', 'hi', 30), msg('1300000000000000004', 'bot', '', 22)]
  const fresh = newMessages(messages, 'admin', 'bot', NOW)
  assert.deepEqual(fresh.admin.map((m) => m.content), ['download', 'the 4 GB one'])
  assert.deepEqual(fresh.bot.map((m) => m.id), ['1300000000000000004'])
  assert.equal(fresh.latest, '1300000000000000004')
  assert.equal(fresh.ready, true)
  assert.equal(replyText(fresh.admin), 'download\n\nthe 4 GB one')
  assert.equal(replyText([msg('1', 'admin', '<@bot> number 3', 30), msg('2', 'admin', '<@!bot>', 25)], 'bot'), 'number 3')
  // Still typing: the last message is under 20 seconds old.
  assert.equal(newMessages([msg('1', 'admin', 'wait', 5)], 'admin', 'bot', NOW).ready, false)
  assert.equal(newMessages([msg('1', 'mum', 'hi', 60)], 'admin', 'bot', NOW).ready, false)
})

test('ids sort as numbers, not text', () => {
  assert.deepEqual([{ id: '1300000000000000010' }, { id: '999999999999999999' }].sort(byId).map((m) => m.id), ['999999999999999999', '1300000000000000010'])
})

test('attachments are named, and an empty message means Discord is hiding it (the Message Content Intent is off)', () => {
  assert.equal(replyText([msg('1', 'admin', '', 30, { attachments: [{ filename: 'shot.png' }] })]), "(attached shot.png, which you can't open)")
  assert.equal(contentHidden([msg('1', 'admin', '', 30)]), true)
  assert.equal(contentHidden([msg('1', 'admin', '', 30, { attachments: [{ filename: 'a.png' }] })]), false)
  assert.equal(contentHidden([msg('1', 'admin', 'hello', 30)]), false)
  assert.equal(contentHidden([]), false)
})

test("the bot's cards since the doctor last looked become lines of news", () => {
  assert.deepEqual(meanwhile([msg('1', 'bot', '', 10, { embeds: [{ title: 'Dead release', description: 'Swapped Dune.2021' }, {}] })]), ['Dead release: Swapped Dune.2021'])
})

test('replies count in Needs you, and in Open for an hour after the doctor said solved; never in Resolved', () => {
  assert.equal(replyable(['Needs you'], undefined, NOW), true)
  assert.equal(replyable(['Open'], NOW + 1000, NOW), true)
  assert.equal(replyable(['Open'], NOW - 1000, NOW), false)
  assert.equal(replyable(['Open'], undefined, NOW), false)
  assert.equal(replyable(['Doctor working'], NOW + 1000, NOW), false)
  assert.equal(replyable(['Resolved'], NOW + 1000, NOW), false)
})

test('buttons: Go ahead and Cancel, and only their own ids are read back', () => {
  const [row] = confirmButtons('abc123')
  assert.deepEqual(
    row.components.map((c) => [c.label, c.custom_id]),
    [
      ['Go ahead', 'doctor:go:abc123'],
      ['Cancel', 'doctor:cancel:abc123'],
    ],
  )
  assert.deepEqual(parseButton('doctor:go:abc123'), { choice: 'go', id: 'abc123' })
  assert.equal(parseButton('doctor:go:../x'), undefined)
  assert.equal(parseButton('other:go:abc'), undefined)
})

test('later: whole minutes from 5 to a week', () => {
  assert.equal(laterMinutes('1440'), 1440)
  assert.throws(() => laterMinutes('2'), /5 to 10080/)
  assert.throws(() => laterMinutes('1.5'), /whole number/)
  assert.throws(() => laterMinutes('20000'), /a week/)
})

test('replies have their own daily cap', () => {
  const state = { replyDay: '', replies: 0 }
  const t = Date.parse('2026-10-23T08:00:00Z')
  assert.equal(admitReply(state, t, 2), true)
  assert.equal(admitReply(state, t, 2), true)
  assert.equal(admitReply(state, t, 2), false)
  assert.equal(admitReply(state, t + 24 * 3_600_000, 2), true)
})

test('reply-only fixes check their arguments, and refuse outside a run answering the Admin', async () => {
  await assert.rejects(async () => REPLY_FIXES.grab.run('36; rm'), /release number/)
  await assert.rejects(async () => REPLY_FIXES.later.run('soon'), /whole number/)
  await assert.rejects(async () => REPLY_FIXES['delete-torrent'].run('../x'), /40-character/)
  // No doctor server here, so no run: nothing reaches Arrmy.
  await assert.rejects(async () => REPLY_FIXES.grab.run('36'), /no Problem is being worked on/)
  await assert.rejects(async () => REPLY_FIXES.unmonitor.run('radarr', '1'), /no Problem is being worked on/)
  assert.ok(!('grab' in FIXES), "the doctor's own runs can't grab")
})

test("the reply prompt: the Admin's words as the only instructions, the news, and the reply-only fixes", () => {
  const text = replyPrompt({ kind: 'Missing', title: 'Dune (2021)' }, 'download number 3', ['Dead release: swapped'])
  assert.ok(text.includes('"""\ndownload number 3\n"""'))
  assert.ok(text.includes('- Dead release: swapped'))
  for (const f of Object.values(REPLY_FIXES) as { usage: string }[]) assert.ok(text.includes(f.usage))
  assert.ok(!text.includes('Arrmy just raised this Problem'), 'a resumed conversation has the Problem already')
  assert.ok(replyPrompt({ kind: 'Missing', title: 'Dune (2021)' }, 'hi', [], false).includes('Arrmy just raised this Problem'))
})

test('otherQuality: the most seeded release turned down only for its quality, when nothing wanted can be had', () => {
  const q = ['WEBRip-720p is not wanted in profile']
  const list = numbered([
    found('1080p dead', { seeders: 51, dead: true }),
    found('1080p blocklisted', { seeders: 6, rejections: ['Release is blocklisted'] }),
    found('720p too big', { seeders: 90, rejections: [...q, 'Too big'] }),
    found('720p few', { seeders: 2, rejections: q }),
    found('720p many', { seeders: 28, rejections: q }),
    found('720p none', { seeders: 0, rejections: q }),
  ])
  assert.equal(otherQuality(list)?.title, '720p many')
  // Something wanted is still there: Radarr grabs that itself.
  assert.equal(otherQuality(numbered([found('1080p', { seeders: 1 }), found('720p', { seeders: 28, rejections: q })])), undefined)
  // Nobody seeding the other quality either.
  assert.equal(otherQuality(numbered([found('720p none', { seeders: 0, rejections: q })])), undefined)
  // A show: only a whole season, never a single episode that might be the wrong one.
  const tv = (title: string, fullSeason: boolean) => found(title, { seeders: 9, rejections: q, fullSeason, grab: { app: 'sonarr', guid: title, indexerId: 1 } })
  assert.equal(otherQuality(numbered([tv('S01E05', false)])), undefined)
  assert.equal(otherQuality(numbered([tv('S01E05', false), tv('S01', true)]))?.title, 'S01')
})
