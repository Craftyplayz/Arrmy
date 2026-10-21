import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Streaming · Phone' }

const SCREENS: [slug: string, label: string][] = [['home', 'Home'], ['requests', 'Requests'], ['admin', 'Admin'], ['settings', 'Settings']]

export default function StreamingPhone() {
  return (
    <div className="st-page">
      <h1>Phone</h1>
      <p className="st-lede">Pictures of how the phone version would look: tabs move to the bottom, the search pill sits under the brand, posters go three to a row.</p>
      <div className="st-phones">
        {SCREENS.map(([slug, label]) => (
          <figure key={slug}>
            <img src={`/layouts/streaming/phone-${slug}.svg`} width={390} height={844} alt={`${label} on a phone`} />
            <figcaption>{label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
