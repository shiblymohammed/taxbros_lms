# TAXBROS LMS Android Release Guide

This document provides step-by-step instructions for building and releasing the TAXBROS LMS Android application.

## Prerequisites

### One-Time Setup

1. **Install Android Studio and SDK**
   - Download and install [Android Studio](https://developer.android.com/studio)
   - Open Android Studio and complete first-run setup to download Android SDK
   - Verify SDK installation at: `%LOCALAPPDATA%\Android\Sdk` (Windows) or `~/Android/Sdk` (Linux/Mac)

2. **Configure JDK 21**
   - This project requires JDK 21 (Gradle 8.14.3 compatibility)
   - Android Studio's bundled JDK may be newer (e.g., JDK 25)
   - **Option A:** In Android Studio → Settings → Build, Execution, Deployment → Build Tools → Gradle → Gradle JDK:
     - Select "Download JDK" and choose JDK 21
   - **Option B:** Download [Oracle JDK 21](https://www.oracle.com/java/technologies/downloads/#java21) or [Adoptium JDK 21](https://adoptium.net/temurin/releases/?version=21)
     - Set `JAVA_HOME` environment variable to the JDK 21 installation path
     - Example: `JAVA_HOME=C:\Program Files\Java\jdk-21`

3. **Verify Prerequisites**
   ```bash
   # Check Android SDK is installed
   ls $ANDROID_HOME  # Should show platforms/, build-tools/, etc.
   
   # Check JDK version (must be 21)
   java -version  # Should show "openjdk version \"21.x.x\""
   ```

## Release Signing Configuration

**⚠️ DO THIS ONCE AND KEEP SAFE** - Losing the keystore means future updates cannot be installed over existing app installations.

### Step 1: Generate Release Keystore

```bash
cd apps/mobile/android

# Windows (using Android Studio's keytool)
"C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -keystore taxbros-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias taxbros

# Linux/Mac
keytool -genkeypair -v -keystore taxbros-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias taxbros
```

**Prompts you'll see:**
- **Keystore password**: Create a strong password (e.g., 20+ random characters) - **WRITE THIS DOWN**
- **Key password**: Use the same password as keystore password
- **First and Last name**: Organization name (e.g., "TAXBROS Learning")
- **Organizational unit**: Department (e.g., "Technology")
- **Organization**: Institute name (e.g., "Acharya Professional Accountants")
- **City/Locality**: Your city
- **State/Province**: Your state
- **Country code**: Two-letter code (e.g., "IN" for India)

### Step 2: Create keystore.properties File

```bash
cd apps/mobile/android
cp keystore.properties.example keystore.properties
```

Edit `keystore.properties` with your keystore details:

```properties
storeFile=taxbros-release.jks
storePassword=YOUR_KEYSTORE_PASSWORD_HERE
keyAlias=taxbros
keyPassword=YOUR_KEY_PASSWORD_HERE
```

**⚠️ SECURITY:**
- `keystore.properties` is git-ignored - never commit it
- `taxbros-release.jks` is git-ignored - never commit it
- Back up both files to a secure location (encrypted USB drive, password manager)
- Without these files, you cannot update the app on user devices

## Confirm Configuration Before First Release

### Package ID (Cannot be changed after release)

The package ID is currently set to `in.taxbros.lms` (placeholder). **Confirm with the institute before building the first release APK.**

To change the package ID:

1. Edit `apps/mobile/capacitor.config.ts`:
   ```typescript
   appId: 'in.taxbros.newid',  // Change this
   ```

2. Edit `apps/mobile/android/app/build.gradle`:
   ```gradle
   namespace = "in.taxbros.newid"  // Line ~13
   applicationId "in.taxbros.newid"  // Line ~16
   ```

3. Edit `apps/mobile/android/app/src/main/res/values/strings.xml`:
   ```xml
   <string name="package_name">in.taxbros.newid</string>
   <string name="custom_url_scheme">in.taxbros.newid</string>
   ```

4. Move the MainActivity.java file to match the new package structure:
   ```bash
   # Old: android/app/src/main/java/in/taxbros/lms/MainActivity.java
   # New: android/app/src/main/java/in/taxbros/newid/MainActivity.java
   ```

### Server URL

Current server URL: `https://taxbros.acharyaprofessionalaccountants.in` (placeholder)

Confirm the production server URL before building. To change:

1. Set the `CAP_SERVER_URL` environment variable when running sync:
   ```bash
   CAP_SERVER_URL=https://YOUR_PRODUCTION_URL pnpm --filter mobile sync
   ```

## Version Management

Before each new release APK, increment the version in `apps/mobile/android/app/build.gradle`:

```gradle
defaultConfig {
    versionCode 2        // Increment by 1 for each release (must always increase)
    versionName "1.0.1"  // Semantic version for display (major.minor.patch)
}
```

**Version Guidelines:**
- `versionCode`: Integer that must increase with each release (1, 2, 3, ...)
- `versionName`: User-facing version string (e.g., "1.0.0", "1.1.0", "2.0.0")
- Increment `versionCode` even for minor fixes
- Follow semantic versioning for `versionName`:
  - Major (1.0.0 → 2.0.0): Breaking changes, major features
  - Minor (1.0.0 → 1.1.0): New features, backward compatible
  - Patch (1.0.0 → 1.0.1): Bug fixes only

## Building the APK

### Debug APK (For Testing)

Build an unsigned debug APK for internal testing:

```bash
# From repository root
pnpm --filter mobile build:apk:debug
```

Output: `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`

**Debug APK Characteristics:**
- Not signed for production
- Can be installed alongside release version (different signature)
- Shows "Debugging enabled" in app info
- Suitable for development and internal testing only

### Release APK (For Distribution)

Build a signed release APK for distribution:

```bash
# From repository root
pnpm --filter mobile build:apk
```

**Prerequisites for release build:**
- `keystore.properties` must exist with correct credentials
- `taxbros-release.jks` keystore file must exist
- Version numbers must be incremented from previous release

Output: `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`

**Release APK Characteristics:**
- Signed with release keystore
- Can be distributed to users
- Will update existing installations (if package ID and keystore match)
- Optimized for production (ProGuard disabled by default)

### Alternative: Build in Android Studio

```bash
# Open project in Android Studio
pnpm --filter mobile open

# Then in Android Studio:
# Build → Generate Signed App Bundle / APK → APK
# Follow the wizard to select keystore and build
```

## Pre-Release Testing Checklist

Test the release APK thoroughly before distribution:

### Authentication Testing
- [ ] Sign in as Student user
- [ ] Sign in as Staff user (with MARK_ATTENDANCE permission)
- [ ] Sign in as Administrator user
- [ ] Verify password change on first login works
- [ ] Verify logout works correctly
- [ ] Verify failed login lockout (5 attempts) works

### Data Synchronization Testing
- [ ] Mark attendance in the mobile app
  - Verify it appears in the web app immediately
- [ ] Mark attendance in the web app
  - Verify it appears in the mobile app after refresh
- [ ] Complete a lesson in the mobile app
  - Verify progress updates on the web dashboard
- [ ] Submit a quiz in the mobile app
  - Verify results appear in web app history

### Offline Handling Testing
- [ ] Enable airplane mode
- [ ] App shows offline page with "Try again" button
- [ ] Disable airplane mode
- [ ] Tap "Try again" - app reconnects successfully
- [ ] Verify no data loss occurred

### Core Functionality Testing (Student)
- [ ] View enrolled courses
- [ ] Watch video lessons
- [ ] Video position saves and resumes correctly
- [ ] Mark lesson as complete
- [ ] View course progress percentage updates
- [ ] Take a quiz and submit answers
- [ ] View quiz results and correct answers
- [ ] Complete GST Registration lab simulation
- [ ] Complete Income Tax Return lab simulation
- [ ] Complete MCA Incorporation lab simulation
- [ ] View personal attendance history

### Core Functionality Testing (Staff)
- [ ] Open attendance register for a class
- [ ] Mark students present/absent/late
- [ ] Save attendance register
- [ ] Reopen register and verify saved status
- [ ] View monthly attendance reports
- [ ] View staff personal attendance

### Core Functionality Testing (Administrator)
- [ ] View dashboard statistics
- [ ] Create new student account
- [ ] Create new staff account
- [ ] Grant staff permissions
- [ ] Enroll student in class
- [ ] Enroll student in course
- [ ] Create new course with modules and lessons
- [ ] Upload course cover image
- [ ] Publish/unpublish courses
- [ ] View student progress reports
- [ ] Generate monthly attendance reports

### Device Compatibility Testing
- [ ] Test on Android 7.0 (API 24) device or emulator (minimum supported)
- [ ] Test on Android 12+ (API 31+) device (target version)
- [ ] Test on small screen (5" phone)
- [ ] Test on large screen (10" tablet)
- [ ] Test in portrait orientation
- [ ] Test in landscape orientation

### Performance Testing
- [ ] App launches in under 3 seconds
- [ ] Video playback starts in under 5 seconds
- [ ] Navigation between pages is smooth
- [ ] Forms submit within 2 seconds on good network
- [ ] No crashes during 15-minute continuous use

## Installation on Physical Device

### Method 1: Direct APK Installation

1. Copy `app-release.apk` to the Android device (via USB, email, cloud storage)
2. On the device, open the file manager and tap the APK file
3. If prompted, enable "Install unknown apps" for the file manager
4. Tap "Install" and wait for completion
5. Open the app from the home screen

### Method 2: ADB Installation

```bash
# Connect device via USB with USB debugging enabled
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk

# -r flag allows reinstall (updates existing installation)
```

### Method 3: Android Studio

1. Connect device via USB
2. Open project in Android Studio (`pnpm --filter mobile open`)
3. Select device from device dropdown
4. Click Run button (green play icon)

## Troubleshooting

### Build Errors

**"Unsupported class file major version 69"**
- Gradle detected JDK 25+ but requires JDK 21
- Solution: Set JAVA_HOME to JDK 21 path or configure in Android Studio settings

**"Keystore file not found"**
- `keystore.properties` or `taxbros-release.jks` is missing
- Solution: Complete the "Release Signing Configuration" section above

**"Failed to find Build Tools revision X.X.X"**
- Android SDK Build Tools not installed
- Solution: Open Android Studio → SDK Manager → SDK Tools → Install "Android SDK Build-Tools"

**"Failed to find Platform SDK with path: platforms/android-XX"**
- Android platform SDK not installed
- Solution: Open Android Studio → SDK Manager → SDK Platforms → Install Android XX

### Runtime Issues

**App shows offline page immediately**
- Server URL is incorrect or unreachable
- Solution: Verify `CAP_SERVER_URL` was set correctly during sync, rebuild

**"App not installed" error**
- Package ID conflicts with existing installation
- Solution: Uninstall old version first, or change package ID

**Video playback doesn't work**
- YouTube embed restrictions or network issue
- Solution: Verify YouTube URLs are "Unlisted" videos, check network

**"This app won't run on your device"**
- Device Android version is below minSdkVersion (API 24)
- Solution: Device must be Android 7.0 or higher

## Distribution Options

### Option 1: Direct Distribution (Current MVP)
- Email APK file to users
- Share via cloud storage (Google Drive, Dropbox)
- Host on institute website for download
- Install via USB during onboarding

**Pros:** Simple, no external dependencies, full control
**Cons:** Users must enable "Install unknown apps", manual updates

### Option 2: Google Play Store (Future)
- Requires Google Play Console account ($25 one-time fee)
- Longer review process (typically 1-3 days)
- Automatic updates for users
- Requires privacy policy and compliance documentation

**Not included in MVP scope** - can be added in future release

## Security Checklist

Before distributing the APK:

- [ ] `keystore.properties` is NOT in version control
- [ ] Keystore passwords are stored securely (not in plain text files)
- [ ] Server URL uses HTTPS (not HTTP) for production
- [ ] APK is scanned for malware (VirusTotal or similar)
- [ ] Keystore and keystore.properties are backed up securely
- [ ] Version code and version name are incremented
- [ ] Release notes document changes from previous version

## Post-Release Checklist

After distributing a new release:

- [ ] Test installation on at least 3 different devices
- [ ] Monitor for crash reports from users
- [ ] Document known issues for next release
- [ ] Archive the APK file with version number
- [ ] Update version tracking document (who has which version)
- [ ] Prepare rollback plan if critical issues found

## Support and Maintenance

### Collecting Crash Reports

Without Play Store, crash reporting is manual:
1. Ask users to screenshot error messages
2. Request logcat output via ADB for technical users
3. Consider adding Sentry or Firebase Crashlytics (future enhancement)

### Updating the App

To release an update:
1. Increment `versionCode` (must increase)
2. Update `versionName` appropriately
3. Build signed release APK with same keystore
4. Distribute new APK using same method as initial release
5. Users install over existing app (data preserved if package ID unchanged)

### Emergency Rollback

If a release has critical issues:
1. Distribute previous known-good APK file (same version codes)
2. Users can install via "Install anyway" if signature matches
3. Fix issues and release new version with incremented version code

## Future Enhancements (Out of MVP Scope)

- Google Play Store publication
- Push notifications for new courses or announcements
- Offline mode with local data caching
- In-app update notifications
- iOS version (requires Xcode and Apple Developer account)
- Code signing for over-the-air (OTA) updates

## Contact and Support

For build issues or questions:
- Review this document thoroughly
- Check the main `README.md` in `apps/mobile/`
- Review Android Studio build logs for specific errors
- Ensure all prerequisites are installed and configured correctly

---

**Last Updated:** 2026-11-21  
**Document Version:** 1.0.0  
**Target App Version:** 1.0.0
