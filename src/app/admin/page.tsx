import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { adminOverview, liveDownloads, type LiveDownload, type Problem } from '@/lib/admin'
import { requestDetails } from '@/lib/arr'
import { listRequests } from '@/lib/db'
import type { Stuck } from '@/lib/problems'
import { requireUser } from '@/lib/session'
import { stuckRequests } from '@/lib/stuck'
import { fixProblem } from '../actions'
import { AutoRefresh } from '../auto-refresh'
import { Downloads } from '../downloads'
import { SubmitButton } from '../submit-button'
import { Hero, num, size } from '../ui'

export const metadata: Metadata = { title: 'Admin' }

const speed = (bytesPerSecond: number) => `${(bytesPerSecond / 1048576).toFixed(1)} MB/s`

const LEDE = "What needs fixing, what's downloading and how full the disks are."

export default async function AdminPage() {
  const user = await requireUser()
  if (!user.is_admin) redirect('/')

  let overview: Awaited<ReturnType<typeof adminOverview>> | undefined
  let downloads: LiveDownload[] = []
  let stuck: Awaited<ReturnType<typeof stuckRequests>> = { items: [], offline: false, indexerNote: undefined }
  try {
    ;[overview, downloads, stuck] = await Promise.all([adminOverview(), liveDownloads().catch(() => []), stuckRequests()])
  } catch (e) {
    console.error(e)
  }
  if (!overview) {
    return (
      <>
        <Hero title="Admin" lede={LEDE} />
        <p className="err">Radarr or Sonarr isn't responding. Check their containers in Portainer.</p>
      </>
    )
  }

  const requests = listRequests()
  const details = await requestDetails(requests).catch(() => undefined)
  const people = new Map<string, { count: number; bytes: number }>()
  requests.forEach((r, i) => {
    const p = people.get(r.username) ?? { count: 0, bytes: 0 }
    people.set(r.username, { count: p.count + 1, bytes: p.bytes + (details?.[i].bytes ?? 0) })
  })
  const ranked = [...people].sort((a, b) => b[1].bytes - a[1].bytes)
  const most = ranked[0]?.[1].bytes || 1

  // Missing shows in Stuck, with why; Discord's #problems still gets it from adminOverview.
  const problems = overview.problems.filter((p) => p.kind !== 'Missing')
  const { speeds, library, disks } = overview
  // A download that's already a Problem isn't listed again under Stuck.
  const isProblem = (s: Stuck) => problems.some((p) => p.service === s.service && ((s.hash && p.hash === s.hash) || s.ids.some((id) => p.ids.includes(id))))
  stuck.items = stuck.items.filter((s) => !isProblem(s))
  return (
    <>
      <Hero title="Admin" lede={LEDE} />
      <AutoRefresh seconds={30} />

      <div className="ar-stats-row">
        <Stat href={problems.length > 0 ? '#problems' : undefined} value={num(problems.length)} label={problems.length === 1 ? 'Problem' : 'Problems'}>
          {problems.length === 0 && 'Nothing needs fixing'}
        </Stat>
        <Stat href={stuck.items.length > 0 ? '#stuck' : undefined} value={num(stuck.items.length)} label="Stuck">
          {stuck.items.length === 0 ? 'Everything is moving' : 'Not downloading yet'}
        </Stat>
        <Stat href={downloads.length > 0 ? '#downloading' : undefined} value={num(downloads.length)} label="Downloading">
          {speeds && `Down ${speed(speeds.down)} · Up ${speed(speeds.up)}`}
        </Stat>
        <Stat value={num(library.movies)} label="Movies">
          {size(library.movieBytes)}
        </Stat>
        <Stat value={num(library.shows)} label="Shows">
          {`${num(library.episodes)} episodes · ${size(library.showBytes)}`}
        </Stat>
      </div>

      <div className="ar-two">
        <div>
          {problems.length > 0 && (
            <section className="ar-panel" id="problems">
              <h2>
                Problems <span className="n">{num(problems.length)}</span>
              </h2>
              <div className="rows">
                {problems.map((p) => (
                  <ProblemRow key={`${p.service}-${p.kind}-${p.hash ?? p.ids.join('-')}`} p={p} badge={p.kind} warn />
                ))}
              </div>
            </section>
          )}

          {(stuck.items.length > 0 || stuck.offline || stuck.indexerNote) && (
            <section className="ar-panel" id="stuck">
              <h2>
                Stuck <span className="n">{num(stuck.items.length)}</span>
              </h2>
              {stuck.offline && <p className="err">qBittorrent has no connection, so nothing can download. Check the VPN (gluetun) in Portainer.</p>}
              {stuck.indexerNote && <p className="ar-sub">{stuck.indexerNote}</p>}
              <div className="rows">
                {stuck.items.map((s) => (
                  <ProblemRow key={`${s.service}-${s.hash ?? s.ids.join('-')}-${s.title}`} p={s} badge={s.reason} warn={WARN.has(s.reason)} />
                ))}
              </div>
            </section>
          )}

          <section className="ar-panel" id="downloading">
            <h2>
              Downloading <span className="n">{num(downloads.length)}</span>
            </h2>
            <Downloads initial={downloads} />
          </section>
        </div>

        <div>
          {(disks.media || disks.settings) && (
            <section className="ar-panel">
              <h2>Disks</h2>
              {disks.media && <DiskBar label="Media disk" disk={disks.media} />}
              {disks.settings && <DiskBar label="Settings disk" disk={disks.settings} />}
            </section>
          )}

          {ranked.length > 0 && (
            <section className="ar-panel">
              <h2>Requests by person</h2>
              <div className="ar-ranks">
                {ranked.map(([name, p], i) => (
                  <div className="ar-rank" key={name}>
                    <span className="ar-rank-n">{i + 1}</span>
                    <span className="grow">
                      <b>{name}</b>
                      <span className="ar-rank-bar">
                        <i style={{ width: `${Math.round((p.bytes / most) * 100)}%` }} />
                      </span>
                    </span>
                    <span className="ar-rank-val">
                      {size(p.bytes)}
                      <small>
                        {num(p.count)} {p.count === 1 ? 'Request' : 'Requests'}
                      </small>
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="ar-panel">
            <h2>Layouts</h2>
            <p className="ar-sub">Fifteen mockups of other ways Arrmy could look, for a future redesign. Nothing on them works.</p>
            <div className="actions">
              <Link className="btn small" href="/layouts">
                Open the layouts
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

const WARN = new Set(['Stalled', 'Fetching file list', 'Error', 'Nothing found'])

/** A Problem or Stuck Request: its title, a badge, why, and its one-click fix if it has one. */
function ProblemRow({ p, badge, warn }: { p: Problem | Stuck; badge: string; warn: boolean }) {
  return (
    <div className="rowi">
      <div className="grow">
        <b>{p.title}</b> <span className={warn ? 'badge r' : 'badge'}>{badge}</span>
        <span className="ar-sub">
          {p.detail}
          {'by' in p && p.by.length > 0 && ` · Requested by ${p.by.join(', ')}`}
        </span>
      </div>
      {p.fix && (
        <form action={fixProblem}>
          <input type="hidden" name="service" value={p.service} />
          <input type="hidden" name="fix" value={p.fix} />
          {p.ids.map((id) => (
            <input key={id} type="hidden" name="id" value={id} />
          ))}
          {p.hash && <input type="hidden" name="hash" value={p.hash} />}
          <input type="hidden" name="title" value={p.title} />
          <SubmitButton className="btn small" pending="Working...">
            {p.fix === 'retry' ? 'Try another release' : 'Search again'}
          </SubmitButton>
        </form>
      )}
    </div>
  )
}

/** A headline number; a link to its section when it has one. */
function Stat({ href, value, label, children }: { href?: string; value: string; label: string; children?: React.ReactNode }) {
  const body = (
    <>
      <b>{value}</b>
      <span>{label}</span>
      {children && <small>{children}</small>}
    </>
  )
  return href ? (
    <a className="ar-stat" href={href}>
      {body}
    </a>
  ) : (
    <div className="ar-stat">{body}</div>
  )
}

/** Turns red under 10% free. */
function DiskBar({ label, disk }: { label: string; disk: { freeSpace: number; totalSpace: number } }) {
  const used = disk.totalSpace ? Math.round(((disk.totalSpace - disk.freeSpace) / disk.totalSpace) * 100) : 0
  const low = disk.freeSpace < disk.totalSpace * 0.1
  return (
    <div className={low ? 'ar-disk warn' : 'ar-disk'}>
      <span>{label}</span>
      <div className="progress" role="progressbar" aria-label={`${label} used`} aria-valuenow={used} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${used}%` }} />
      </div>
      <small>{low ? `Only ${size(disk.freeSpace)} free · ${used}% used` : `${size(disk.freeSpace)} free of ${size(disk.totalSpace)} · ${used}% used`}</small>
    </div>
  )
}
