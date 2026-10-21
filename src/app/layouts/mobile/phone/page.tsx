import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Phone app · Phone' }

const SCREENS: [file: string, caption: string][] = [['home', 'Home'], ['requests', 'Requests'], ['admin', 'Admin'], ['settings', 'Settings']]

export default function Phone() {
  return (
    <>
      <h1 className="lm-title">On a phone</h1>
      <p className="lm-lede">This style is the same phone app on a desktop and on a phone, so these pictures show it at true phone size. Swipe sideways for each tab.</p>
      <div className="lm-phones">
        {SCREENS.map(([file, caption]) => (
          <figure key={file}>
            <img src={`/layouts/mobile/phone-${file}.svg`} width={390} height={844} alt={`${caption} on a phone`} />
            <figcaption>{caption}</figcaption>
          </figure>
        ))}
      </div>
    </>
  )
}
