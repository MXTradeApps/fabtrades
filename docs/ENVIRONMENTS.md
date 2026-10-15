# Environments

Two environments, **production** and **staging**, and one rule: no build decides
which one it is at runtime. Every client is told at build time, and a build that is
not told fails immediately rather than defaulting to production.

That rule exists because of subscriptions. A sandbox purchase in a test build must
not be able to write a real entitlement, and the only reliable way to guarantee
that is for the test build to be physically unable to reach the production
database.

## Which project is which

| | Production | Staging |
| --- | --- | --- |
| Supabase | `tenrvaghaspwdvnwvgrh` (RiftTrades / FABTrades) | `cnmxaccamqshgvesieez` (**fabloodle**) |
| Web | `fabtrades.net` via Netlify `production` context | Netlify preview/branch contexts |
| Mobile | `env/production.json` | `env/staging.json` |

Staging reuses the existing **fabloodle** Supabase project rather than a paid
persistent branch of production. Same migrations are applied there (the fabloodle
Wordle tables sit beside them; they do not collide), so sandbox purchases write
entitlement rows without standing up another billable database. The trade-off is
that schema drift between the two projects is possible — apply migrations to both
when they change.

If fabloodle is ever retired as staging, the paid-branch path is still documented
below as the longer-term option.

## Applying schema and functions to staging

FABTrades tables and Edge Functions have to exist on fabloodle before a staging
build can sync or record a purchase:

```bash
supabase login
supabase link --project-ref cnmxaccamqshgvesieez
supabase db push
supabase secrets set \
  REVENUECAT_WEBHOOK_SECRET=<any long random string> \
  RECONCILE_SECRET=<a different long random string> \
  REVENUECAT_API_KEY=sk_<secret key from RevenueCat> \
  REVENUECAT_ENTITLEMENT_ID='FABTrades Pro'
supabase functions deploy revenuecat-webhook
supabase functions deploy reconcile-entitlements
```

Then in RevenueCat → **Integrations → Webhooks**, add a webhook (or a second one
filtered to sandbox) pointing at:

`https://cnmxaccamqshgvesieez.supabase.co/functions/v1/revenuecat-webhook`

with `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>`. Keep the production
webhook on `tenrvaghaspwdvnwvgrh` so live purchases never hit fabloodle.

Card catalog data is not shared automatically. Run the price pipeline once against
fabloodle (`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` from that project) if a
staging build needs a usable binder; purchase-flow testing only needs auth + the
entitlements tables.

Auth providers on fabloodle need the same Apple / Google / Discord setup as
production, plus `fabtrades://login-callback` in the redirect allow-list — see
[AUTH_PROVIDERS.md](./AUTH_PROVIDERS.md).

## Longer-term option: a paid persistent branch

A persistent Supabase branch of production (`~$0.32/day`) shares auth provider
setup and cannot drift structurally. Create it with:

```bash
supabase link --project-ref tenrvaghaspwdvnwvgrh
supabase --experimental branches create staging --persistent
supabase --experimental branches list          # note BRANCH PROJECT ID
```

Then point `apps/mobile/env/staging.json`, `[remotes.staging]` in
`supabase/config.toml`, and the Netlify preview contexts at that branch ref
instead of fabloodle.

## How each client is told

### Mobile

`--dart-define-from-file`, one file per environment in
[apps/mobile/env](../apps/mobile/env):

```sh
flutter run --dart-define-from-file=env/production.json
flutter build appbundle --release --dart-define-from-file=env/staging.json
```

There is no default. `SupabaseConfig.assertConfigured()` runs before anything
touches the network and throws with instructions, so a forgotten flag is a startup
failure on the first run rather than a support ticket about missing data.

Outside production, Settings shows a "Test build" row naming the environment. A
tester who cannot tell which database they are pointed at will eventually report
staging data as a production bug.

The publishable keys in those files are committed deliberately: they are public by
design, gated by RLS. Real secrets stay out — RevenueCat API keys come from CI
secrets (`REVENUECAT_GOOGLE_API_KEY`, `REVENUECAT_APPLE_API_KEY`), and a build
without one runs with subscriptions switched off rather than with the test-store
key.

### Web

Vite environment variables, set per deploy context in
[netlify.toml](../netlify.toml) rather than in the Netlify dashboard, so the
mapping is reviewable:

| Variable | Meaning |
| --- | --- |
| `VITE_SUPABASE_URL` | Project REST endpoint |
| `VITE_SUPABASE_ANON_KEY` | Publishable key |
| `VITE_APP_ENV` | `production` or `staging`; naming only |

Locally, copy `apps/web/.env.example` to `apps/web/.env`.

All three are read through [`src/config/env.js`](../apps/web/src/config/env.js),
which consults Vite's `import.meta.env` in the browser and `process.env` under
Node, because `scripts/generateSeoPages.js` prerenders pages with the same Supabase
queries at build time.

### Price pipeline

Already environment-driven: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, from
GitHub secrets in CI or `services/price-pipeline/.env` locally. This one holds a
real secret — the service role key bypasses RLS. It must never appear in a client
build or in this repository.

## Release builds

| Build | Environment |
| --- | --- |
| Android (`release-android-closed.yml`) | `environment` workflow input, default `production` |
| iOS (local Xcode / `flutter build ipa`) | `--dart-define-from-file=env/<name>.json`, use `production` for TestFlight |
| Netlify production | `production` |
| Netlify previews | `production` today; optionally `staging` (fabloodle) |

Both mobile workflows check that the chosen env file actually has a `SUPABASE_URL`
before building, so an unfilled `staging.json` fails the build rather than shipping
an app that crashes on launch.

Use staging for anything exercising purchases. Sandbox transactions on both stores
are indistinguishable from real ones as far as the app is concerned; the database
they land in is the only boundary that holds.
