import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { adminOverview, type Problem } from '@/lib/admin'
import { requestDetails } from '@/lib/arr'
import { listRequests } from '@/lib/db'
import { requireUser } from '@/lib/session'
import { fixProblem } from '../actions'
import { AutoRefresh } from '../auto-refresh'
import { SubmitButton } from '../submit-button'
import { Hero, num, Ring } from '../ui'

export const metadata: Metadata = { title: 'Admin' }

const size = (bytes: number) => (bytes >= 1e12 ? `${(bytes / 1e12).toFixed(2)} TB` : `${(bytes / 1e9).toFixed(1)} GB`)
const speed = (bytesPerSecond: number) => `${(bytesPerSecond / 1048576).toFixed(1)} MB/s`

const LEDE = "What needs fixing, what's downloading and how full the disks are."

export default async function AdminPage() {
  const user = await requireUser()
  if (!user.is_admin) redirect('/')

  let overview: Awaited<ReturnType<typeof adminOverview>> | undefined
  try {
    overview = await adminOverview()
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

  const { problems, downloads, speeds, library, disks } = overview
  return (
    <>
      <Hero title="Admin" lede={LEDE} />
      {downloads.length > 0 && <AutoRefresh seconds={5} />}

      <div className="ar-stats-row">
        <Stat href={problems.length > 0 ? '#problems' : undefined} value={num(problems.length)} label={problems.length === 1 ? 'Problem' : 'Problems'}>
          {problems.length === 0 && 'Nothing needs fixing'}
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
        {disks.media && <DiskStat label="Media disk" disk={disks.media} />}
        {disks.settings && <DiskStat label="Settings disk" disk={disks.settings} />}
      </div>

      {problems.length > 0 && (
        <>
          <h2 className="ar-h" id="problems">
            Problems <span className="n">{num(problems.length)}</span>
          </h2>
          <div className="rows">
            {problems.map((p) => (
              <ProblemRow key={`${p.service}-${p.kind}-${p.hash ?? p.ids.join('-')}`} p={p} />
            ))}
          </div>
        </>
      )}

      {downloads.length > 0 && (
        <>
          <h2 className="ar-h" id="downloading">
            Downloading <span className="n">{num(downloads.length)}</span>
          </h2>
          <div className="rows">
            {downloads.map((d, i) => {
              const percent = d.size ? Math.round(((d.size - d.sizeleft) / d.size) * 100) : 0
              return (
                <div className="rowi" key={i}>
                  <div className="grow">
                    <span className="ar-name">{d.title}</span>
                    <div className="progress" role="progressbar" aria-label={`${d.title} progress`} aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                      <i style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                  <small>
                    {percent}% of {size(d.size)}
                  </small>
                </div>
              )
            })}
          </div>
        </>
      )}

      {ranked.length > 0 && (
        <>
          <h2 className="ar-h">Requests by person</h2>
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
        </>
      )}
    </>
  )
}

function ProblemRow({ p }: { p: Problem }) {
  return (
    <div className="rowi">
      <div className="grow">
        <b>{p.title}</b> <span className={p.kind === 'Missing' ? 'badge' : 'badge r'}>{p.kind}</span>
        <span className="ar-sub">{p.detail}</span>
      </div>
      <form action={fixProblem}>
        <input type="hidden" name="service" value={p.service} />
        <input type="hidden" name="fix" value={p.fix} />
        {p.ids.map((id) => (
          <input key={id} type="hidden" name="id" value={id} />
        ))}
        {p.hash && <input type="hidden" name="hash" value={p.hash} />}
        <SubmitButton className="btn small" pending="Working...">
          {p.fix === 'retry' ? 'Try another release' : 'Search again'}
        </SubmitButton>
      </form>
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
function DiskStat({ label, disk }: { label: string; disk: { freeSpace: number; totalSpace: number } }) {
  const used = disk.totalSpace ? Math.round(((disk.totalSpace - disk.freeSpace) / disk.totalSpace) * 100) : 0
  const low = disk.freeSpace < disk.totalSpace * 0.1
  return (
    <div className={low ? 'ar-stat ar-stat-ring warn' : 'ar-stat ar-stat-ring'}>
      <Ring p={used} label={`${label} ${used}% used`} />
      <span>
        {label}
        <small>{low ? `Only ${size(disk.freeSpace)} free` : `${size(disk.freeSpace)} free of ${size(disk.totalSpace)}`}</small>
      </span>
    </div>
  )
}
