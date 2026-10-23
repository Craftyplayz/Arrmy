// The Admin replying to The Doctarr in a Problem's thread, in plain words. Discord sends Arrmy no messages (only slash
// commands and button clicks), so every 20 seconds Arrmy reads the threads waiting on the Admin, and hands what they
// wrote to The Doctarr, with what the bot posted there meanwhile. Only DISCORD_ADMIN_ID's messages count. The rules are
// in replyrules.ts; the run itself in doctor.ts.
import { problemThread } from './botrules'
import { cancelPending } from './confirm'
import { botUserId, post, threadMessages, typing } from './discord'
import { getThread } from './db'
import { busy, remember, reply, threadStates, updateState } from './doctor'
import { embed } from './embeds'
import { contentHidden, meanwhile, newMessages, replyable, replyText } from './replyrules'

const LATER_TEXT = 'No new message from the Admin: earlier they asked you to look at this again now.'

/** One look at every thread waiting on the Admin. */
export async function checkReplies(now = Date.now()) {
  const admin = process.env.DISCORD_ADMIN_ID
  if (!admin || !process.env.DOCTOR) return
  const bot = await botUserId()
  for (const [key, s] of Object.entries(threadStates())) {
    const row = getThread(key)
    const tags: string[] = row ? JSON.parse(row.tags) : []
    // Deleted by hand, or the Problem went away: if it comes back, The Doctarr looks again and this starts afresh.
    if (!row || tags.includes('Resolved')) {
      updateState(key, () => undefined)
      continue
    }
    if (busy.has(key)) continue // what's written meanwhile waits until this run ends
    if (tags.includes('Doctarr working')) {
      // Working, but no run: Arrmy restarted mid-run, and its answer is lost.
      await post(problemThread(s.problem, 'Needs you'), embed({ colour: 'danger', app: 'Arrmy', description: 'Arrmy restarted while The Doctarr was working, so its answer is lost. Reply to have it carry on.' }))
        .then((id) => remember(key, id))
        .catch((e: Error) => console.warn(`[replies] ${key}: ${e.message}`))
      continue
    }
    if (s.later && s.later.at <= now) {
      updateState(key, (x) => x && { ...x, later: undefined })
      await start(key, s.problem, [LATER_TEXT, s.later.note].filter(Boolean).join(' '), [])
      continue
    }
    if (!replyable(tags, s.openUntil, now)) continue
    if (!s.seen) {
      // A thread from before replies were read, or whose first card failed: replies count from now on.
      const latest = (await threadMessages(key))?.at(-1)?.id
      if (latest) updateState(key, (x) => x && { ...x, seen: latest })
      continue
    }
    const messages = await threadMessages(key, s.seen)
    if (!messages?.length) continue
    const mine = new Set(s.mine ?? [])
    const fresh = newMessages(messages, admin, bot, now)
    if (!fresh.admin.length) continue
    if (contentHidden(fresh.admin)) {
      if (!s.hiddenTold) {
        updateState(key, (x) => x && { ...x, hiddenTold: true })
        const id = await post(
          problemThread(s.problem),
          embed({
            colour: 'danger',
            app: 'Arrmy',
            title: "Can't read your reply",
            description:
              "Discord hides what people write from the bot until its Message Content Intent is on: Discord Developer Portal → your app → Bot → Privileged Gateway Intents → Message Content Intent. Until then, @mention the bot in your reply and it can read it.",
          }),
        )
        remember(key, id)
      }
      continue
    }
    if (!fresh.ready) continue // still typing: several messages in a row go as one reply
    updateState(key, (x) => x && { ...x, seen: fresh.latest })
    await cancelPending(key)
    await start(key, s.problem, replyText(fresh.admin, bot), meanwhile(fresh.bot.filter((m) => !mine.has(m.id))))
  }
}

async function start(key: string, problem: Parameters<typeof reply>[0], words: string, news: string[]) {
  await typing(key)
  void reply(problem, words, news)
}
