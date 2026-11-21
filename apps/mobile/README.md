# TAXBROS LMS Android app

A Capacitor 8 wrapper around the hosted web app (R33). The app opens `CAP_SERVER_URL`, so the web app,
PWA and Android app share one backend, one login and the same records. If the server can't be reached,
the app shows a bundled "You're offline" page with a Try again button.

| Setting | Value | Where |
|---|---|---|
| App name | TAXBROS LMS | `capacitor.config.ts`, `android/app/src/main/res/values/strings.xml` |
| Package ID | `in.taxbros.lms` (placeholder: confirm with the institute before the first release) | `CAP_APP_ID` / `capacitor.config.ts`, `android/app/build.gradle` |
| Server URL | `https://taxbros.acharyaprofessionalaccountants.in` (placeholder) | `CAP_SERVER_URL` |
| Min / target Android | 7.0 (API 24) / API 36 | `android/variables.gradle` (Capacitor 8 defaults) |
| Icon, splash | Generated from `assets/icon-only.png` (TAXBROS logo) | `pnpm assets` |

The package ID can't be changed after the app is installed on devices, so settle it first. To change it,
edit `appId`, then `namespace`/`applicationId` in `android/app/build.gradle`, the strings in `strings.xml`,
and move `android/app/src/main/java/in/taxbros/lms/MainActivity.java` to the matching folder.

## One-time setup

1. Install [Android Studio](https://developer.android.com/studio) and open it once so it downloads the Android SDK.
2. Use **JDK 21** for Gradle. Android Studio's bundled JDK may be newer than this project's Gradle supports:
   in Android Studio → Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK, pick a JDK 21
   (Android Studio can download one), or set `JAVA_HOME` to a JDK 21 for command-line builds.

## Point the app at the server and sync

```bash
# from the repository root
CAP_SERVER_URL=https://DOMAIN pnpm --filter mobile sync
```

PowerShell: `$env:CAP_SERVER_URL='https://DOMAIN'; pnpm --filter mobile sync`

For local testing on the emulator against `pnpm dev` (the emulator reaches your PC at `10.0.2.2`):

```bash
CAP_SERVER_URL=http://10.0.2.2:3000 pnpm --filter mobile sync
```

Plain `http` is allowed only in this local mode. Also set `NEXT_PUBLIC_API_URL=http://10.0.2.2:4000/api` in
`apps/web/.env.local` and add `http://10.0.2.2:3000` to the API's `CORS_ORIGIN`, then restart both.

## Release signing (once, keep safe)

```bash
cd apps/mobile/android
keytool -genkeypair -v -keystore taxbros-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias taxbros
cp keystore.properties.example keystore.properties   # fill in the passwords
```

`keytool` is in Android Studio's `jbr/bin`. The keystore and `keystore.properties` are git-ignored. **Back both
up somewhere safe**: without them, future APKs can't be installed as updates over the existing app.

## Build the APK

```bash
pnpm --filter mobile build:apk         # signed release APK (needs keystore.properties)
pnpm --filter mobile build:apk:debug   # debug APK for testing
```

Output: `android/app/build/outputs/apk/release/app-release.apk`. Or open the project in Android Studio
(`pnpm --filter mobile open`) and use Build → Generate Signed App Bundle / APK.

Before each new APK, increase `versionCode` (and `versionName`) in `android/app/build.gradle`.

## Install and check (T7)

1. Copy the APK to the phone and open it (allow "Install unknown apps" for the file manager), or
   `adb install -r app-release.apk`.
2. Sign in as a student, staff member and administrator.
3. Make a change in the app (e.g. mark attendance) and confirm it shows on the web app, and the reverse.
4. Turn on airplane mode: the offline page appears; turn it off and tap Try again.

Not included (out of MVP scope): Play Store publication, push notifications, offline mode, iOS.

## Icons and splash

`assets/icon-only.png` and `assets/icon-foreground.png` (1024×1024) are made from the TAXBROS logo. Replace
them with final artwork if the institute supplies some, then run `pnpm --filter mobile assets` and `sync`.
