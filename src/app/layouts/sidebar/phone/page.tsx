import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Sidebar · Phone' }

const SCREENS: [file: string, label: string][] = [
  ['home', 'Home'],
  ['requests', 'Requests'],
  ['admin', 'Admin'],
  ['settings', 'Settings'],
]

export default function PhonePage() {
  return (
    <>
      <div className="head">
        <h1>Phone</h1>
        <span className="sub">Pictures of how the phone version would look: the sidebar collapses to a hamburger drawer and the tables become stacked cards. Click one to open it full size.</span>
      </div>
      <div className="phones">
        {SCREENS.map(([file, label]) => {
          const src = `/layouts/sidebar/phone-${file}.svg`
          return (
            <figure key={file}>
              <a href={src} target="_blank" rel="noreferrer"><img src={src} width={390} height={844} alt={`${label} on a phone`} /></a>
              <figcaption>{label}</figcaption>
            </figure>
          )
        })}
      </div>
    </>
  )
}
