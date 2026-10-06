# Building the Android APK

CASE 404 is a Capacitor app: the web game in `www/` is wrapped by the native
Android project in `android/`.

## Prerequisites

- Node.js 18+
- JDK 17 (Temurin recommended)
- Android SDK (via [Android Studio](https://developer.android.com/studio) or command-line tools)
  - Platform 34, Build-Tools 34.x
- Environment: `ANDROID_HOME` pointing at the SDK

## Option A — Android Studio (easiest)

```bash
npm install
npm run build:web     # copies index.html + src/ + data/ + public/ + assets/ into www/
npx cap sync android
```

Then open the `android/` folder in Android Studio and press **Run** (or
**Build ▸ Build Bundle(s)/APK(s) ▸ Build APK(s)**).

## Option B — Command line

```bash
npm install
npm run apk:debug     # build:web → cap sync → gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk

npm run apk:release   # assembleRelease (unsigned; add a keystore to sign)
```

### Signing a release build

Create `android/key.properties` (do **not** commit it):

```properties
storeFile=/absolute/path/to/release.keystore
storePassword=***
keyAlias=case404
keyPassword=***
```

And wire it in `android/app/build.gradle` with the standard
`signingConfigs.release` block before running `assembleRelease`.

## Option C — CI (no local SDK needed)

The repo ships `.github/workflows/android.yml`. Every push to `main` builds a
debug APK and uploads it as a workflow artifact (**Actions ▸ Android APK ▸
CASE-404-debug-apk**). Tagged releases automatically attach the APK to a
GitHub Release.

## Project id / naming

- App id: `com.arsam92.case404`
- App name: `CASE 404`

## Web-only development

No SDK needed to develop the game itself:

```bash
npx serve .
# open http://localhost:5173 — use browser devtools mobile viewport (390×844)
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `cap sync` copies an empty site | Run `npm run build:web` first — `www/` is generated. |
| Gradle complains about JDK | Use JDK 17 (`java -version`). |
| White screen on device | Ensure `data/` and `src/` were copied into `www/` (build:web) and re-sync. |
| No sound on first tap | Expected — Android starts audio after the first user gesture. |
