import type { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cultivate Focus',
    short_name: 'Cultivate',
    description: 'A personal growth and focus app to cultivate discipline and consistency.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F8FAF9',
    theme_color: '#16a34a',
    icons: [
      {
        src: 'https://picsum.photos/seed/focus-icon/192/192',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'https://picsum.photos/seed/focus-icon-large/512/512',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
