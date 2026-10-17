# Sideloaded APK releases share one signing identity and one version train

The Android app is distributed as an APK attached to GitHub Releases, not through an app store, for now. Every push to `main` and every pushed version tag publishes two releases: a versioned release at `v<version>` carrying `vocabkr-<version>.apk` and its `.sha256` checksum, and a rolling `latest` release whose single asset, `vocabkr.apk`, is replaced in place. The `latest` URL is the tester's stable link; the versioned releases keep every build downloadable after it stops being current. Pull-request runs publish nothing. Installation is by sideloading the APK; the README carries the tester steps.

Android treats an APK as an update of an installed app only when the package name (`com.voyagera.vocabkr`) and the signing certificate match and its `versionCode` is at least as high as the installed build's. The release keystore is therefore the app's permanent identity, not a build detail: every release is signed with it so that a newer build installs over the one already on the device and keeps the learner's local data. The workflow materialises the keystore from four repository secrets, signs the APK, and verifies the signer's SHA-256 certificate against the keystore before publishing; a `main` or tag run with a missing secret fails rather than publish a debug-signed APK, while a fork pull request — which cannot read the secrets — is a debug-signed smoke test and publishes nothing. A lost keystore or credential cannot be repaired: a replacement certificate is a different identity, so its first APK cannot install over the old app, and an uninstall takes the learner's local data with it.

The container image and the APK share one version train. The workflow's `prepare` job computes one version string per run from the version tags in git and the container registry; a pushed version tag supplies the version for that run, with any `-pre.N` suffix stripped, while a `main` push computes the next development version. That same string tags the container image (`<version>` and `latest`) and becomes the APK's `versionName` and the basis of the versioned release's tag (`v<version>`) and asset name. The rolling `latest` tag matches no version pattern and is excluded from the computation, so it never influences the next version. There is no second Android version number to keep in step.

`versionCode` is derived from that string by `src/lib/release/version.ts`, not assigned by hand or taken from a run counter. It packs the version into fixed-width decimal fields, so that comparing two codes as integers orders the versions they encode:

```text
major     minor     patch     ordinal
10^9      10^7      10^5      10^0
```

`0.1.0-pre.11` becomes `10000011`; the final `0.1.0` becomes `10000999`, because a final release carries `999` in the ordinal field and so sits above every pre-release of the same base version but below `0.1.1-pre.1` (`10100001`). Minor and patch each hold `0..99`, a pre-release ordinal must be below `999`, and the result must stay inside the signed 32-bit integer Android reads — at least `1` and at most `2147483647` — which bounds major at `2` and rejects some `2.x` versions as well. The encoding also rejects leading zeros and any form other than `major.minor.patch[-pre.N]`, failing the release rather than producing a wrong code.

## Considered options

**Workflow artifacts as the distribution channel.** The pipeline still uploads an APK artifact for run inspection, but using it to reach testers is rejected: GitHub delivers artifacts as a zip behind a sign-in at an unstable, expiring run URL, so installing meant finding a run, downloading, unzipping, and transferring a file. Releases serve the APK itself, without a login, at a stable URL.

**An app store.** Rejected for now: an account, a listing, and review stand between every build and its testers, and there is no store listing today. This record does not rule out revisiting the choice; adopting a store that requires its own signing key would reopen the identity decision and carry the same one-way reinstall.

**A download page of our own.** Rejected: it would host bytes without the versioned releases, checksums, generated notes, and unauthenticated stable links that GitHub Releases already provides, while still requiring the same sideload step.

**A fresh or debug key per build.** Rejected: every build would be a new identity, so every install would require uninstalling the previous app and losing its local data. One permanent key is what makes the update path work.

**A hand-maintained or CI-run-number `versionCode`.** Rejected: it would be a second version train to keep aligned with the semantic version, and it would not order a final release above the pre-releases of the same base version. Encoding the code from the one version string makes that ordering a property of the version itself.

## Consequences

The `latest` release, its tag, and its asset name are a public contract: the asset is replaced in place and the tag moved, never deleted, or the tester link breaks. The four signing secrets become operational infrastructure; losing any of them is losing the app's identity, and a rotation forces every installed copy to be uninstalled, taking Downloaded Decks and unsynced Queued Grades with it. The version alphabet is bounded by the encoding: minor and patch below `100`, pre-release ordinals below `999`, and a code inside Android's signed 32-bit range. Changing the encoding, or reaching those bounds, cannot produce a lower code for an already-installed build without another one-way reinstall. Versioned releases stay signed by the key that made them, so after a rotation an old release can only be installed fresh over nothing; it cannot update a new-key build.
