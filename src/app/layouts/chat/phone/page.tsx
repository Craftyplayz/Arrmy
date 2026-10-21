import type { Metadata } from 'next'
import { Compose, Day, Head, Msg } from '../bits'

export const metadata: Metadata = { title: 'Chat feed · Phone' }

const SHOTS: [file: string, caption: string][] = [['home', 'Home'], ['requests', 'Requests'], ['admin', 'Admin'], ['settings', 'Settings']]

export default function ChatPhone() {
  return (
    <>
      <Head name="phone" topic="How the phone version would look." />
      <div className="lc-feed">
        <Day label="Today" />
        <Msg from="Arrmy" time="Today at 14:40">
          <p>These are pictures of how the phone version would look: the channel list becomes a bar at the bottom, and the message box stays put.</p>
          <div className="lc-phones">
            {SHOTS.map(([file, caption]) => (
              <figure key={file}>
                <img src={`/layouts/chat/phone-${file}.svg`} width={390} height={844} alt={`${caption} on a phone`} />
                <figcaption>{caption}</figcaption>
              </figure>
            ))}
          </div>
        </Msg>
      </div>
      <Compose channel="phone" />
    </>
  )
}
