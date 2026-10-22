import { getSetting } from '@/lib/db'
import { botEnabled } from '@/lib/discord'
import { APPS } from '@/lib/feeds'
import { absKey, tmdbKey } from '@/lib/keys'
import { saveKeys } from '../actions'
import { SubmitButton } from '../submit-button'

const timeout = (ms: number) => new Promise<never>((_, reject) => setTimeout(() => reject(new Error('No answer')), ms))

/** Each app checked live, all at once; a down app only shows as down. */
async function checks() {
  return Promise.all(
    Object.entries(APPS).map(async ([name, check]) => {
      try {
        return { name, version: (await Promise.race([check(), timeout(4000)])).version, down: false }
      } catch {
        return { name, version: undefined, down: true }
      }
    }),
  )
}

/** Which apps answer, and which keys Arrmy has. Values are never shown. */
export async function ConnectedApps({ saved }: { saved: boolean }) {
  const apps = await checks()
  const keys = [
    { name: 'Plex token', set: !!getSetting<string>('plexToken'), hint: 'Sign in again to refresh it.' },
    { name: 'Audiobookshelf API key', set: !!absKey(), hint: 'Enter it below.' },
    { name: 'TMDB key', set: !!tmdbKey(), hint: 'Enter it below. Without it Discover and searching by person or studio stay hidden.' },
    { name: 'Discord bot', set: botEnabled(), hint: 'Set DISCORD_BOT_TOKEN, DISCORD_GUILD_ID and DISCORD_PUBLIC_KEY.' },
  ]
  return (
    <section className="ar-panel" id="apps">
      <h2>Connected apps</h2>
      {apps.map((a) => (
        <p key={a.name}>
          <strong>{a.name}</strong> <span className="pill">{a.down ? 'Down' : 'Up'}</span>
          {a.version && <small className="muted"> {a.version}</small>}
        </p>
      ))}
      <h3>Keys</h3>
      {keys.map((k) => (
        <p key={k.name}>
          <strong>{k.name}</strong> <span className="pill">{k.set ? 'Set' : 'Not set'}</span>
          {!k.set && <small className="muted"> {k.hint}</small>}
        </p>
      ))}
      <form action={saveKeys} className="form">
        {saved && <p className="ok">Saved.</p>}
        <p className="ar-sub">Leave a box empty to keep the key as it is. A key set in the environment wins over one entered here.</p>
        <label>
          Audiobookshelf API key
          <input className="field" name="absKey" type="password" autoComplete="off" />
        </label>
        <label>
          TMDB key
          <input className="field" name="tmdbKey" type="password" autoComplete="off" />
        </label>
        <div className="actions">
          <SubmitButton className="btn primary" pending="Saving...">
            Save keys
          </SubmitButton>
        </div>
      </form>
    </section>
  )
}
