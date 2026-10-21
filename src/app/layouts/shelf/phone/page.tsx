import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Shelf · Phone' }

const SCREENS: [file: string, caption: string][] = [['home', 'Home'], ['requests', 'Requests'], ['admin', 'Admin'], ['settings', 'Settings']]

export default function ShelfPhone() {
  return (
    <>
      <h1>On a phone</h1>
      <p className="lede">Pictures of how the phone version would look: shelves scroll sideways with three covers each, and the tabs sit at the bottom.</p>
      <div className="phones">
        {SCREENS.map(([file, caption]) => (
          <figure key={file}>
            <img src={`/layouts/shelf/phone-${file}.svg`} width={390} height={844} alt={`${caption} on a phone`} />
            <figcaption>{caption}</figcaption>
          </figure>
        ))}
      </div>
    </>
  )
}
