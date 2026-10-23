import { createPublicKey, verify } from 'node:crypto'
import { after } from 'next/server'
import { answer } from '@/lib/commands'
import { clicked } from '@/lib/confirm'
import { answerInteraction } from '@/lib/discord'
import { embed } from '@/lib/embeds'
import { parseButton } from '@/lib/replyrules'

// Discord's public key is the raw 32 bytes of an Ed25519 key; this prefix makes it a key node:crypto can read.
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

/** Whether Discord really sent this: every request is signed with the app's key, and anything else is refused. */
function fromDiscord(body: string, signature: string | null, timestamp: string | null) {
  const key = process.env.DISCORD_PUBLIC_KEY
  if (!key || !signature || !timestamp) return false
  try {
    const publicKey = createPublicKey({ key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(key, 'hex')]), format: 'der', type: 'spki' })
    return verify(null, Buffer.from(timestamp + body), publicKey, Buffer.from(signature, 'hex'))
  } catch {
    return false
  }
}

type Interaction = {
  type: number
  application_id: string
  token: string
  data?: { name: string; options?: { name: string; value: unknown }[]; custom_id?: string }
  member?: { user: { id: string } }
  user?: { id: string }
}

/** Slash commands: the app's Interactions Endpoint URL in Discord points here. */
export async function POST(request: Request) {
  const body = await request.text()
  if (!fromDiscord(body, request.headers.get('x-signature-ed25519'), request.headers.get('x-signature-timestamp')))
    return new Response('Bad signature', { status: 401 })

  const interaction = JSON.parse(body) as Interaction
  if (interaction.type === 1) return Response.json({ type: 1 }) // Discord checking the endpoint works
  if (interaction.type === 3) return button(interaction)
  if (interaction.type !== 2 || !interaction.data) return new Response(null, { status: 400 })

  const { name, options = [] } = interaction.data
  // Discord wants a reply within 3 seconds, so say "thinking…" now and edit in the answer when it's ready.
  after(async () => {
    const cards = await answer(name, Object.fromEntries(options.map((o) => [o.name, String(o.value)]))).catch((e) => [
      embed({ colour: 'danger', app: 'Arrmy', title: "Couldn't answer", description: `${e.message}. Try again in a minute.`, at: false }),
    ])
    await answerInteraction(interaction.application_id, interaction.token, cards).catch((e) => console.warn(`[discord] /${name}: ${e.message}`))
  })
  return Response.json({ type: 5, data: { flags: 64 } }) // 64: only whoever asked sees it
}

/** Go ahead or Cancel under something the doctor asked to do (confirm.ts). Only the Admin's click counts. */
function button(interaction: Interaction) {
  const parsed = parseButton(interaction.data?.custom_id ?? '')
  if (!parsed) return new Response(null, { status: 400 })
  const clicker = interaction.member?.user.id ?? interaction.user?.id
  if (!process.env.DISCORD_ADMIN_ID || clicker !== process.env.DISCORD_ADMIN_ID)
    return Response.json({ type: 4, data: { flags: 64, content: 'Only the Admin can answer this.' } })
  // Removing can take longer than Discord's 3 seconds: say "working…" now, and swap in what came of it.
  after(async () => {
    const card = await clicked(parsed.id, parsed.choice)
    await answerInteraction(interaction.application_id, interaction.token, [card], []).catch((e) => console.warn(`[discord] button: ${e.message}`))
  })
  return Response.json({ type: 6 }) // the message stays as it is until the edit
}
