# Releasing

Web ships continuously. Mobile ships from one tag.

## Web

Netlify builds `main` from `apps/web`. There is nothing to do beyond merging, and
nothing to coordinate — the web app reads the same `entitlements` row the apps write
to, so it cannot be out of step with them in any way a customer would notice.

The site also rebuilds on its own once a day. The build bakes the card catalog into
a static file for the fast path, and `update-prices.yml` pings a Netlify build hook
after each ingest so that file catches up (see [mobile/DATABASE.md](mobile/DATABASE.md)).
The hook lives in the `NETLIFY_BUILD_HOOK` repository secret. The website does not
depend on it for correctness: each visit compares the snapshot to
`fab_card_prices.updated_at` and reads the database when the pipeline is newer.

## Mobile

```bash
# Set the version in apps/mobile/pubspec.yaml first, and merge it.
git tag mobile-v1.2.0
git push origin mobile-v1.2.0
```

That single tag marks the commit both stores ship:

| Platform | How | Result |
| --- | --- | --- |
| Android | `.github/workflows/release-android-closed.yml`, triggered by the `mobile-v*` tag | Signed AAB → Play closed testing (`alpha`) |
| iOS | Local Xcode archive of the tagged commit (Product → Archive → Distribute App) | Signed IPA → TestFlight |

### Why one tag

The two stores used to ship from separate, untagged builds, which meant they could
carry **different commits under the same version string**. That was
tolerable for a free calculator. It is not once a subscription decides what the code
does: a customer reporting that Pro does not unlock on Android, at version 1.2.0,
tells you nothing if Android's 1.2.0 is not the same code as iOS's.

### What the tag must not disagree with

`apps/mobile/pubspec.yaml` is the source of truth for the version name. The Android
workflow runs `scripts/check-release-tag.sh` before doing any real work and fails if
the tag does not name the pubspec version. Before archiving iOS, run the same check
locally: `scripts/check-release-tag.sh mobile-v1.2.0`.

The check exists because nothing downstream performs it. Play and App Store Connect
each take whatever version they are handed, so `mobile-v1.2.0` carrying a binary that
says `1.1.0` ships silently and is then permanent — neither store lets a version be
reused. `scripts/check-release-tag.test.sh` covers the check itself, and CI runs it.

Build numbers are deliberately absent from the tag. Play auto-increments from the
highest `versionCode` it has seen, and the iOS build number is bumped in Xcode (or
`--build-number`) above the latest TestFlight build, so
they are properties of an upload rather than of a release.

### Builds that are not releases

Both platforms still build on demand:

- **Android** — run the workflow manually (Actions → Release Android → Run workflow).
  Choose the track, and choose `staging` to point the build at the staging Supabase
  project. On a tag, the inputs are absent and it defaults to `alpha`, `completed`, and
  `production`, so a sandbox purchase can never reach production entitlements by
  accident.
- **iOS** — archive locally in Xcode from any commit. For a staging TestFlight build,
  build with `--dart-define-from-file=env/staging.json` instead of `production`.

A manual build has no tag, so nothing enforces that the two stores agree. That is fine
for a test build and is the reason releases go through the tag.

### After the tag

1. Watch the Android workflow and the TestFlight upload. They are the two
   places a release actually fails.
2. Bump `version:` in `apps/mobile/pubspec.yaml` for the next release, so `main` is
   never sitting on a version that has already shipped.
