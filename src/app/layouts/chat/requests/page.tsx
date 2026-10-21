import type { Metadata } from 'next'
import { Fragment } from 'react'
import { admin, requests, type MockStatus } from '../../data'
import { Avatar, Compose, Day, Embed, Head, Msg, Pinned, RequestEmbed, TONE } from '../bits'

export const metadata: Metadata = { title: 'Chat feed · Requests' }

const c = admin.counts
const COUNTS: [status: MockStatus, n: number][] = [['Requested', c.requested], ['Downloading', c.downloading], ['Importing', c.importing], ['Available', c.available], ['Stuck', c.stuck]]
const day = (ago: string) => (ago.endsWith('h ago') ? 'Today' : ago === 'yesterday' ? 'Yesterday' : 'Earlier')
/** The thread under Shōgun: what Arrmy did as the Request moved along. */
const LOG: [what: string, when: string][] = [
  ['Found 3 releases', '2 days ago'],
  ['Grabbed Shogun.S01.1080p.WEB, 29.2 GB', '2 days ago'],
  ['Downloaded. Checking the files…', '1 h ago'],
  ['Importing… 96%', 'just now'],
]

export default function ChatRequests() {
  return (
    <>
      <Head name="requests" topic="Every Request, newest first. Arrmy replies in a thread as each one moves along." />
      <Pinned><b>Status board</b> · {requests.length} Requests · {COUNTS.map(([s, n]) => `${n} ${s}`).join(' · ')}</Pinned>
      <div className="lc-feed">
        <Msg from="Arrmy" time="Today at 07:00" pinned>
          <p>Where everything is right now.</p>
          <Embed tone="blurple" title="Status board">
            <div className="lc-counts">
              {COUNTS.map(([s, n]) => <span key={s} className={`lc-count t-${TONE[s]}`}><b>{n}</b><small>{s}</small></span>)}
            </div>
            <small className="lc-foot">{requests.length} Requests from {admin.requesters.length} Requesters · updated just now</small>
          </Embed>
        </Msg>
        {requests.map((r, i) => (
          <Fragment key={r.id}>
            {(i === 0 || day(requests[i - 1].requestedAgo) !== day(r.requestedAgo)) && <Day label={day(r.requestedAgo)} />}
            <Msg from={r.requestedBy} time={r.requestedAgo}>
              <p>Requested <b>{r.title.title}</b> ({r.detail})</p>
              <RequestEmbed r={r} />
              <div className="lc-reacts">
                <button type="button" className="lc-react">Details</button>
                <button type="button" className="lc-react">Remove</button>
              </div>
              {r.id === 105 && (
                <div className="lc-thread">
                  <span className="lc-thread-h">{LOG.length} replies from Arrmy</span>
                  {LOG.map(([what, when]) => <span key={what}><Avatar name="Arrmy" small />{what}<time>{when}</time></span>)}
                </div>
              )}
            </Msg>
          </Fragment>
        ))}
      </div>
      <Compose channel="requests" placeholder="Type a title to request it…" />
    </>
  )
}
