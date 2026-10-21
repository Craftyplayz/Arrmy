import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Tiles · Phone' }

const SHOTS = ['Home', 'Requests', 'Admin', 'Settings']

export default function TilesPhone() {
  return (
    <>
      <h1 className="t-page">Phone</h1>
      <p className="t-lede">Pictures of how the phone version would look: the bento becomes a single column of tiles with a tab bar along the bottom.</p>
      <div className="t-phones">
        {SHOTS.map(s => (
          <figure key={s}>
            <img src={`/layouts/tiles/phone-${s.toLowerCase()}.svg`} width={390} height={844} alt={`${s} on a phone`} />
            <figcaption>{s}</figcaption>
          </figure>
        ))}
      </div>
    </>
  )
}
