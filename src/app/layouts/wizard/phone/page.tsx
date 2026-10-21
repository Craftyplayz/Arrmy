import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'One thing at a time · Phone' }

const SHOTS: [file: string, caption: string][] = [['home', 'Home'], ['requests', 'Requests'], ['admin', 'Admin'], ['settings', 'Settings']]

export default function WizardPhone() {
  return (
    <div className="wz-page wide">
      <h1 className="wz-title">On a phone</h1>
      <p className="wz-lede">Pictures of how the phone version would look: one step fills the screen, with a Next button at the bottom.</p>
      <div className="wz-phones">
        {SHOTS.map(([file, caption]) => (
          <figure key={file} className="wz-phone">
            <img src={`/layouts/wizard/phone-${file}.svg`} width={390} height={844} alt={`${caption} on a phone`} />
            <figcaption>{caption}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}
