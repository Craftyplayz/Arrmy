import { admin, poster, requests, type MockRequest, type MockStatus, type MockTitle } from '../data'

const HUES: Record<string, number> = { Crafty: 200, Sam: 140, Jo: 320, Alex: 40 }
/** Status to colour class, same convention as the real site: green, blue, gold, grey, red. */
export const TONE: Record<MockStatus, string> = { Requested: 'grey', Downloading: 'blue', Importing: 'gold', Available: 'green', Stuck: 'red' }

const PIN = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M16 2l6 6-4 1-2 3 1 6-2 2-4-5-6 6-1-1 6-6-5-4 2-2 6 1 3-2z" />
  </svg>
)

/** A coloured circle with the first letter; Arrmy (the bot) gets the site icon on blurple. */
export function Avatar({ name, small }: { name: string; small?: boolean }) {
  const cls = small ? 'lc-av lc-av-sm' : 'lc-av'
  if (name === 'Arrmy') return <span className={`${cls} lc-av-bot`}><img src="/icon.svg" alt="" /></span>
  return <span className={cls} style={{ background: `hsl(${HUES[name] ?? 0} 50% 45%)` }}>{name[0]}</span>
}

/** One message in the timeline. Arrmy's own messages get a BOT tag. */
export function Msg({ from, time, pinned, children }: { from: string; time: string; pinned?: boolean; children: React.ReactNode }) {
  return (
    <article className={pinned ? 'lc-msg is-pinned' : 'lc-msg'}>
      <Avatar name={from} />
      <div className="lc-msg-body">
        <header className="lc-msg-head">
          <b>{from}</b>{from === 'Arrmy' && <span className="lc-bot">BOT</span>}<time>{time}</time>
          {pinned && <span className="lc-pin">{PIN}Pinned</span>}
        </header>
        {children}
      </div>
    </article>
  )
}

export const Day = ({ label }: { label: string }) => <div className="lc-day"><span>{label}</span></div>

export const Chip = ({ status }: { status: MockStatus }) => <span className={`lc-chip t-${TONE[status]}`}>{status}</span>

export const Progress = ({ value, tone }: { value: number; tone: string }) => (
  <div className="lc-progrow"><div className={`lc-prog t-${tone}`}><i style={{ width: `${value}%` }} /></div>{value}%</div>
)

/** A bot-style card: a coloured left edge, an optional heading, whatever goes inside. */
export function Embed({ tone = 'grey', title, children }: { tone?: string; title?: string; children: React.ReactNode }) {
  return <div className={`lc-embed t-${tone}`}>{title && <b className="lc-embed-h">{title}</b>}{children}</div>
}

/** A Request as an embed: poster, title line, status chip, progress while moving, who asked and when. */
export function RequestEmbed({ r, children }: { r: MockRequest; children?: React.ReactNode }) {
  const moving = r.status === 'Downloading' || r.status === 'Importing'
  return (
    <Embed tone={TONE[r.status]}>
      <div className="lc-row">
        <i className="lc-poster" style={poster(r.title.hue)} />
        <div className="lc-embed-body">
          <b className="lc-title">{r.title.title}</b>
          <span className="lc-meta">{r.title.year} · {r.title.type} · {r.detail}</span>
          <Chip status={r.status} />
          {moving && <Progress value={r.progress} tone={TONE[r.status]} />}
          <small className="lc-foot">Requested by {r.requestedBy} · {r.requestedAgo}{r.sizeGb > 0 && ` · ${r.sizeGb} GB`}</small>
          {children}
        </div>
      </div>
    </Embed>
  )
}

/** A search hit as a compact row: Request it, or its chip if someone already has. */
export function Result({ t }: { t: MockTitle }) {
  const r = requests.find((x) => x.title.id === t.id)
  return (
    <div className="lc-res">
      <i className="lc-poster lc-poster-sm" style={poster(t.hue)} />
      <span className="lc-grow"><b>{t.title}</b><small>{t.year} · {t.type} · {t.runtime}</small></span>
      {r ? <Chip status={r.status} /> : <button type="button" className="lc-b primary small">Request</button>}
    </div>
  )
}

/** The channel header: # name, its topic, who is in it. */
export function Head({ name, topic }: { name: string; topic: string }) {
  return (
    <header className="lc-head">
      <span className="lc-hash">#</span><b>{name}</b><span className="lc-topic">{topic}</span>
      <span className="lc-members">{admin.requesters.length} Requesters</span>
    </header>
  )
}

/** The bar under the header that Discord shows for a pinned message. */
export function Pinned({ children }: { children: React.ReactNode }) {
  return <div className="lc-pinned">{PIN}<span className="lc-lab">Pinned</span>{children}</div>
}

/** The message box: how you ask for things. */
export function Compose({ channel, value, placeholder, hint }: { channel: string; value?: string; placeholder?: string; hint?: string }) {
  return (
    <div className="lc-compose">
      <div className="lc-box">
        <span className="lc-plus">+</span>
        <input aria-label={`Message #${channel}`} defaultValue={value} placeholder={placeholder ?? `Message #${channel}`} />
        <button type="button" className="lc-b primary small">Send</button>
      </div>
      {hint && <p className="lc-hint">{hint}</p>}
    </div>
  )
}
