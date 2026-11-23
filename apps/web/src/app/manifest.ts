import type { MetadataRoute } from 'next';

/**
 * Web app manifest (Task 63, R32). Served by Next.js at /manifest.webmanifest.
 * Installable on Chrome/Edge (desktop and Android) as a standalone app.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'TAXBROS LMS',
    short_name: 'TAXBROS',
    description: 'TAXBROS institute learning, attendance and practice-lab platform',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#0f4c5c',
    categories: ['education'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
