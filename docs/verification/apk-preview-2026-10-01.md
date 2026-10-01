# Android preview APK — 2026-10-01

EAS completed the Android internal-distribution build successfully (`FINISHED`).

- Version: `0.1.0`, Android version code `1`.
- Package: `com.maktabi.mobile`.
- Profile: `preview` (`android.buildType: apk`).
- Source commit: `0027457dbf3f3fcd46f0685f2022a343b33c7b3c` on `main`.
- Expo project: `@orion3dnan3/maktabi`, ID `46a246da-3406-47fe-b862-d8c2c21fa0ff`.
- Build ID: `24a59cf7-b7fd-463d-9b46-f7d3b9a37ec6`.
- Completed: `2026-10-01T11:05:04.471Z` (14:05 Kuwait).
- [Build details](https://expo.dev/accounts/orion3dnan3/projects/maktabi/builds/24a59cf7-b7fd-463d-9b46-f7d3b9a37ec6).
- [Download APK](https://expo.dev/artifacts/eas/N0aGqMSqasFXgNDNv6GLyYOQ6HQ4RvEyg8_J0VOjEA8.apk).

## Artifact verification

Downloaded to `artifacts/maktabi-preview-0.1.0-1.apk` (ignored by Git).

- Size: `111650356` bytes (approximately 106.5 MiB).
- SHA-256: `BF2305BD98A115AA8E6CC6CF42258F41A848C1F65488F96D14A0B10B94E3136B`.
- APK archive opened successfully; contains `AndroidManifest.xml`, five DEX files, the bundled JavaScript, and native libraries for `arm64-v8a`, `armeabi-v7a`, `x86`, and `x86_64`.
- EAS generated the Android signing key remotely. No signing credentials were downloaded into this repository.

## Validation scope

The earlier integration checks (205 tests, workspace type checks, lint and bundle exports) are recorded in [the integration report](trial-integration-2026-10-01.md). This build adds a successful native Android release compilation and artifact download; it does not constitute on-device acceptance testing.

Local Expo Doctor passed 20 of 21 checks. The remaining check recommended newer patch versions of Expo, expo-constants, expo-document-picker and expo-router. The locked dependencies were retained for this build, which completed successfully. Library deprecation warnings also appeared during native compilation.

Installation, startup, approval through the platform-owner UI, and the two-device/offline acceptance flow still need testing on actual devices as described in [the trial release guide](../trial-release.md). No live test accounts or offices were created for this APK build.
