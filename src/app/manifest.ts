import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Arrmy',
    short_name: 'Arrmy',
    description: 'Request movies, TV shows and audiobooks for the family Plex server',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#1e2329', // --bg
    theme_color: '#171b20', // --sunken, the colour of the top bar
    icons: [
      { src: '/pwa-icon/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa-icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
