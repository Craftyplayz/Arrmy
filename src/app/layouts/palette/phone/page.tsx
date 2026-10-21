import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Command palette · Phone' }

const SHOTS: [file: string, caption: string][] = [['home', 'Home'], ['requests', 'Requests'], ['admin', 'Admin'], ['settings', 'Settings']]

export default function PalettePhone() {
  return (
    <>
      <h1 className="pal-h">Phone</h1>
      <p className="pal-lede">
        Pictures of how the phone version would look: the palette becomes a full-screen sheet with the input at the bottom above the keyboard,
        and the status bar becomes a bottom tab bar.
      </p>
      <div className="pal-phones">
        {SHOTS.map(([file, caption]) => (
          <figure key={file}>
            <img src={`/layouts/palette/phone-${file}.svg`} width={390} height={844} alt={`${caption} on a phone`} />
            <figcaption>{caption}</figcaption>
          </figure>
        ))}
      </div>
    </>
  )
}
