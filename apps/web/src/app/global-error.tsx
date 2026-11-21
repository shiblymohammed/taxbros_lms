'use client';

/**
 * Last-resort error boundary for failures in the root layout itself.
 * Must render its own <html>/<body> and avoid app components.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', display: 'grid', placeItems: 'center', minHeight: '100vh', margin: 0 }}>
        <div style={{ textAlign: 'center', padding: 24 }}>
          <h1 style={{ fontSize: 20 }}>TAXBROS LMS is temporarily unavailable</h1>
          <p style={{ color: '#555' }}>Please try again in a moment.</p>
          <button onClick={reset} style={{ minHeight: 44, padding: '0 20px', marginTop: 12 }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
