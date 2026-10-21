import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Board · Phone' }

const SHOTS: [file: string, caption: string][] = [['home', 'Home'], ['requests', 'Requests'], ['admin', 'Admin'], ['settings', 'Settings']]

export default function BoardPhone() {
  return (
    <>
      <div className="lb-toolbar"><h1>Phone</h1></div>
      <p className="lb-lede">
        Pictures of how the phone version would look: the board's columns become swipeable pages with a segmented control at the top, and the tabs move
        to the bottom.
      </p>
      <div className="lb-phones">
        {SHOTS.map(([file, caption]) => (
          <figure key={file}>
            <img src={`/layouts/board/phone-${file}.svg`} width={390} height={844} alt={`${caption} on a phone`} />
            <figcaption>{caption}</figcaption>
          </figure>
        ))}
      </div>
    </>
  )
}
