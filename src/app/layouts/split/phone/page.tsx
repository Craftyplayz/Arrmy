import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Split pane · Phone' }

const SHOTS: [file: string, caption: string][] = [['home', 'Home'], ['requests', 'Requests'], ['admin', 'Admin'], ['settings', 'Settings']]

/** Phone: pictures only. The list fills the screen, a row pushes the detail as a new screen, the rail becomes a bottom bar. */
export default function SplitPhone() {
  return (
    <section className="phone" aria-label="Phone pictures">
      <p className="phone-lede">Pictures of how the phone version would look: the list fills the screen, tapping a row pushes the detail pane as a new screen with a back arrow, and the rail becomes a bottom bar.</p>
      <div className="shots">
        {SHOTS.map(([file, caption]) => (
          <figure key={file}>
            <img src={`/layouts/split/phone-${file}.svg`} width={390} height={844} alt={`${caption} on a phone`} />
            <figcaption>{caption}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
