# voabkr

A mobile-first Korean vocabulary and grammar study app: SvelteKit on the web and in a Capacitor Android shell.

## Install on Android

**Download the latest APK:**
<https://github.com/Fankhauserli/voabkr-frontend/releases/download/latest/vocabkr.apk>

The link downloads the APK itself — there is no zip to extract and no GitHub sign-in. To sideload it:

1. Open the downloaded `vocabkr.apk` on the phone.
2. When Android asks, allow installing unknown apps for the browser or file manager you opened it from.

Every build is signed with the same release key, so a newer build installs over the one already on the device and keeps its data. Android 7.0 (API 24) or newer is required.

Every build also has a permanent versioned release on the [Releases page](https://github.com/Fankhauserli/voabkr-frontend/releases), so an older build can be downloaded again if a new one does not work.

## Development

Requires [Bun](https://bun.sh/). Node 22 or newer is only needed to run the Node server build.

```sh
bun install
bun run dev
```

| Command                      | What it does                                        |
| ---------------------------- | --------------------------------------------------- |
| `bun run dev`                | Start the Vite development server                   |
| `bun run format`             | Format the repository with Prettier                 |
| `bun run lint`               | Check formatting with Prettier and lint with ESLint |
| `bun run check`              | Type-check with `svelte-check`                      |
| `bun run test:unit --run`    | Run the unit tests once (Vitest, Node environment)  |
| `bun run test:browser --run` | Run the browser tests once (Vitest + Playwright)    |

The browser tests need Playwright's Chromium build: `bunx playwright install chromium`.

## Building

### Static web build (the APK's web bundle)

```sh
bun run build:static
```

The output is written to `build/`. This is the build the Android shell packages — never the Node server build.

### Node server build

```sh
bun run build:node
node build/index.js
```

The server listens on `PORT` (default `3000`) and `HOST` (default `0.0.0.0`).

### Docker

```sh
docker build -t voabkr .
docker run --rm -p 3000:3000 voabkr
```

Published images are available for every release as `ghcr.io/fankhauserli/voabkr-frontend/voabkr-frontend:<version>` and `:latest`.

### Local APK build

Requires JDK 21 and an Android SDK (`ANDROID_HOME`, or `android/local.properties` pointing at it).

```sh
bun run build:static
bunx cap sync android
cd android
./gradlew assembleRelease
```

The APK is written to `android/app/build/outputs/apk/release/app-release.apk`.

CI injects the version fields as `-PversionCode=… -PversionName=…`; a local build without them keeps the module's `1` / `1.0` placeholders. A local build also has no `android/keystore.properties`, so Gradle signs it with the debug key: it installs, but it cannot upgrade a release-signed build.

## Configuration

The API base URL is chosen in `src/lib/api/client.ts`:

- **Any target:** `VITE_API_URL` overrides everything. It is read at build time, so set it for the build (CI reads the repository variable of the same name for the APK).
- **Native Android shell:** defaults to `https://vocabkr.voyagera.ch/api/v1`.
- **Web browser:** defaults to `/api/v1` — proxied in development and same-origin in production.
- **Node server:** `BACKEND_URL` (read at runtime) plus `/api/v1`, defaulting to `http://localhost:8080/api/v1`.

## Releases

Every push to `main` and every pushed version tag publishes two GitHub Releases:

- `v<version>` — permanent, carrying `vocabkr-<version>.apk` and its `.sha256` checksum.
- `latest` — the rolling release whose single asset is `vocabkr.apk`, replaced in place on every build. Its tag is moved to the build it carries. Do not delete it or rename the asset: that URL is the one testers install from.

The APK is signed with the repository's permanent release keystore, and the workflow verifies the signer certificate before publishing. A `-pre` version is marked a pre-release; a final version can take the repository's Latest slot.

For how a tester installs a published build, see [Install on Android](#install-on-android).

### Signing secrets

Release builds are signed with the permanent release keystore, which the workflow materialises from four repository secrets:

- `ANDROID_KEYSTORE_BASE64` — the keystore file, base64-encoded.
- `ANDROID_KEYSTORE_PASSWORD` — the keystore password.
- `ANDROID_KEY_ALIAS` — the alias of the signing key.
- `ANDROID_KEY_PASSWORD` — the signing key's password.

A push to `main` or a version tag with any of these missing fails before the APK is assembled. A pull request from a fork cannot read repository secrets: its run warns, falls back to debug signing, and publishes no release. The workflow writes the keystore and its properties file to `android/keystore.jks` and `android/keystore.properties` (both git-ignored) for the build; only files from `artifacts/` are uploaded.

### Losing or rotating the keystore

The release keystore is the app's permanent identity. Android installs a newer APK over an installed app only when both are signed by the same certificate and the `versionCode` is at least as high, so the keystore is what makes an in-place update possible at all, while the version orders builds. Keep a copy of the keystore and the values behind all four secrets somewhere durable outside the repository: the repository secrets are the copy CI uses, not a backup.

If the keystore or any of its credentials is lost, or the key must be rotated deliberately:

1. Create a replacement keystore with `keytool -genkeypair` (or your usual tooling), with a validity long enough to outlive the app. Keep its password, alias, and key password with it.
2. Replace all four repository secrets with the new keystore's values. Base64-encode the keystore for `ANDROID_KEYSTORE_BASE64`.
3. Publish a release. The workflow signs with the new key and verifies the APK's certificate against it. From that run, `latest` serves a new-key APK; earlier versioned releases remain old-key.
4. Uninstall the app on every device before installing the new APK. Uninstalling deletes the app's local data, including Downloaded Decks and Queued Grades that have not synced. A newer release still carries a higher `versionCode`; the signature mismatch, not the version, is what blocks the upgrade.
5. Install an old versioned release only over a fresh installation. Moving between the old and new identities always requires an uninstall, in either direction.

Warn testers before rotating so they can Sync first; Grades the backend has already accepted survive the uninstall, but local data that never reached it does not. There is no recovery procedure that preserves an installed app: a lost key cannot be regenerated, and a replacement is a different identity.

## Documentation

- [Frontend specification](FRONTEND_SPEC.md)
- [Glossary](GLOSSARY.md)
- [Architecture decisions](docs/adr/)

## License

GPL-3.0 — see [LICENSE](LICENSE).
