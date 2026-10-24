# Build environments

Each file here is a set of `--dart-define` values for one environment:

```sh
flutter run --dart-define-from-file=env/production.json
flutter build appbundle --release --dart-define-from-file=env/staging.json
```

Xcode Run does not take `--dart-define-from-file`. Sync the same values into
the iOS project first (defaults to production):

```sh
tool/sync_ios_dart_defines.sh env/production.json
```

Without one of these the app throws at startup. That is deliberate — see the note
in [supabase_config.dart](../lib/core/config/supabase_config.dart).

`staging.json` points at the **fabloodle** Supabase project
(`cnmxaccamqshgvesieez`) so sandbox purchases write there instead of production.
Why that project, and what still has to be deployed on it, is in
[docs/ENVIRONMENTS.md](../../../docs/ENVIRONMENTS.md).

These are safe to commit. Publishable keys are public by design: every catalog
table is read-only under RLS and per-user data is scoped to `auth.uid()`. Real
secrets — RevenueCat API keys, signing keys, service-role keys — are passed
separately by CI and never live in this directory.

Push notifications for price alerts read optional `FIREBASE_*` values from the same
files; without them push is simply off. See
[docs/PRICE_ALERTS.md](../../../docs/PRICE_ALERTS.md).
