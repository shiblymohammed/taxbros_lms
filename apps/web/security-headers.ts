/**
 * HTTP security headers for the web app (Task 70, R2).
 *
 * The CSP allows the YouTube player (lesson videos) and the API origin, and nothing else.
 * Next.js needs inline scripts for hydration, so script-src keeps 'unsafe-inline';
 * development additionally needs 'unsafe-eval' and websockets for hot reload.
 */
export function buildSecurityHeaders(apiOrigin: string, isProduction: boolean) {
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isProduction ? '' : " 'unsafe-eval'"} https://www.youtube.com https://s.ytimg.com`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: https://i.ytimg.com ${apiOrigin}`,
    "font-src 'self' data:",
    `connect-src 'self' ${apiOrigin}${isProduction ? '' : ' ws: wss:'}`,
    'frame-src https://www.youtube.com https://www.youtube-nocookie.com',
    "media-src 'self' blob:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProduction ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

  const headers = [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    // Only fullscreen and autoplay are needed (YouTube player); everything else is off
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self "https://www.youtube.com" "https://www.youtube-nocookie.com"), autoplay=(self "https://www.youtube.com" "https://www.youtube-nocookie.com")',
    },
  ];

  if (isProduction) {
    // One year; only honoured over HTTPS
    headers.push({ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' });
  }

  return headers;
}
