import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Magazine · Phone' }

const SHOTS: [file: string, caption: string][] = [['home', 'Home'], ['requests', 'Requests'], ['admin', 'Admin'], ['settings', 'Settings']]

export default function MagazinePhone() {
  return (
    <>
      <h1 className="lm-title">Phone</h1>
      <p className="lm-lede">Pictures of how the phone version would look: a single column, the masthead shrinks and the section nav scrolls sideways.</p>
      <div className="lm-phones">
        {SHOTS.map(([file, caption]) => (
          <figure key={file}>
            <img src={`/layouts/magazine/phone-${file}.svg`} width={390} height={844} alt={`${caption} on a phone`} />
            <figcaption>{caption}</figcaption>
          </figure>
        ))}
      </div>
    </>
  )
}
