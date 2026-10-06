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

That single tag drives both stores:

| Pipeline | Trigger | Result |
| --- | --- | --- |
| `.github/workflows/release-android-closed.yml` | `mobile-v*` tag | Signed AAB → Play closed testing (`alpha`) |
| `codemagic.yaml` → `ios-testflight` | `mobile-v*` tag | Signed IPA → TestFlight |

### Why one tag

The two stores used to ship from a Codemagic UI button and a manual dispatch, which
meant they could carry **different commits under the same version string**. That was
tolerable for a free calculator. It is not once a subscription decides what the code
does: a customer reporting that Pro does not unlock on Android, at version 1.2.0,
tells you nothing if Android's 1.2.0 is not the same code as iOS's.

### What the tag must not disagree with

`apps/mobile/pubspec.yaml` is the source of truth for the version name. Both pipelines
run `scripts/check-release-tag.sh` before doing any real work, and both fail if the tag
does not name the pubspec version.

The check exists because nothing downstream performs it. Play and App Store Connect
each take whatever version they are handed, so `mobile-v1.2.0` carrying a binary that
says `1.1.0` ships silently and is then permanent — neither store lets a version be
reused. `scripts/check-release-tag.test.sh` covers the check itself, and CI runs it.

Build numbers are deliberately absent from the tag. Play auto-increments from the
highest `versionCode` it has seen, and Codemagic from the latest TestFlight build, so
they are properties of an upload rather than of a release.

### Builds that are not releases

Both pipelines still build on demand:

- **Android** — run the workflow manually (Actions → Release Android → Run workflow).
  Choose the track, and choose `staging` to point the build at the staging Supabase
  project. On a tag, the inputs are absent and it defaults to `alpha`, `completed`, and
  `production`, so a sandbox purchase can never reach production entitlements by
  accident.
- **iOS** — start a build in Codemagic. With no tag, the version check reports that
  there is nothing to check and the build proceeds. Override `APP_ENVIRONMENT` in the
  UI for a staging TestFlight build.

A manual build has no tag, so nothing enforces that the two stores agree. That is fine
for a test build and is the reason releases go through the tag.

### After the tag

1. Watch both pipelines. The Android upload and the TestFlight submission are the two
   places a release actually fails.
2. Bump `version:` in `apps/mobile/pubspec.yaml` for the next release, so `main` is
   never sitting on a version that has already shipped.
