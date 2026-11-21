import type { CapacitorConfig } from '@capacitor/cli';

/**
 * TAXBROS LMS Android app (Task 64, R33).
 *
 * The app is an internet-connected wrapper around the hosted web app: it loads CAP_SERVER_URL,
 * so web, PWA and Android all use the same backend and records. `www/` only holds the page
 * shown when the server cannot be reached.
 *
 *   CAP_SERVER_URL=https://lms.example.com pnpm --filter mobile sync
 *
 * Development against a local `next dev` from the Android emulator:
 *   CAP_SERVER_URL=http://10.0.2.2:3000 pnpm --filter mobile sync
 */
const serverUrl = process.env.CAP_SERVER_URL || 'https://taxbros.acharyaprofessionalaccountants.in';
const isHttp = serverUrl.startsWith('http://');

const config: CapacitorConfig = {
  // Package ID and name are client choices; change both before the first release build
  appId: process.env.CAP_APP_ID || 'in.taxbros.lms',
  appName: 'TAXBROS LMS',
  webDir: 'www',
  server: {
    url: serverUrl,
    // Plain http is allowed only for local development URLs
    cleartext: isHttp,
    androidScheme: 'https',
    errorPath: 'offline.html',
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: isHttp,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#111827',
      overlaysWebView: false,
    },
  },
};

export default config;
