# FAB Trades

An app to balance Flesh and Blood card trades.

## Features

- **Trade Balancing**: Helps balance card trades by analyzing market prices
- **Real-time Price Data**: Up-to-date TCGplayer pricing from the shared card database
- **Discord Authentication**: Sign in with Discord to access personal features
- **Trade History**: Save and load trades from your personal history (requires authentication)
- **Trade Sharing**: Share trades via URL with anyone

## Repository layout

One repo, two client apps sharing one Supabase backend. iOS and Android are a single
Flutter codebase, not two ports.

```
apps/
  web/                  React 19 + Vite web app, deployed to Netlify
  mobile/               Flutter app, builds both iOS and Android
services/
  price-pipeline/       Nightly TCGCSV -> Supabase price ingest (Node)
supabase/
  migrations/           Database schema, in version control
  functions/            Edge Functions
packages/
  contracts/            Golden fixtures shared by the web and mobile test suites
docs/                   Architecture, setup guides, and changelog
```

Each app owns its own dependencies, so run commands from the app directory rather than
the repo root. `packages/contracts` holds the cross-language test fixtures that keep the
duplicated JavaScript and Dart business logic honest: the same rules are implemented
twice, so the fixtures are what stop the two copies from drifting apart.

## Card & Price Data

All card and price data lives in a shared Supabase Postgres database (see
[docs/mobile/DATABASE.md](./docs/mobile/DATABASE.md)). No price data is committed to this
repository.

- The **Update FAB Prices** GitHub Action
  ([.github/workflows/update-prices.yml](./.github/workflows/update-prices.yml)) runs the
  ingest pipeline ([services/price-pipeline](./services/price-pipeline)) daily, fetching
  TCGplayer data from tcgcsv.com and publishing it to the database only.
- The web app reads the catalog from the `fab_cards_with_prices` view and set metadata from
  `fab_sets` via [apps/web/src/services/fabDb.js](./apps/web/src/services/fabDb.js).
- The Flutter mobile app ([apps/mobile](./apps/mobile)) reads from the same database.
- SEO pages are pre-rendered at build time from the same database
  ([apps/web/scripts/generateSeoPages.js](./apps/web/scripts/generateSeoPages.js)), so
  production builds need network access to Supabase.

## Development

### Prerequisites

- Node.js v18 or higher (web app, price pipeline)
- Flutter stable (mobile app)

### Web app

```bash
cd apps/web
cp .env.example .env
npm install
npm run dev      # development server
npm run build    # production build + SEO prerender
npm test         # Jest suite
npm run lint
```

### Mobile app

```bash
cd apps/mobile
flutter pub get
flutter run --dart-define-from-file=env/production.json
flutter test
flutter analyze
```

Both clients are told which Supabase project to use at build time and refuse to start
without it, so that a test build cannot write to production. The environments, and how
to stand up staging, are in [docs/ENVIRONMENTS.md](./docs/ENVIRONMENTS.md).

Subscription builds need their RevenueCat key passed in; debug builds fall back to the
Test Store automatically. See
[apps/mobile/lib/core/config/revenuecat_config.dart](./apps/mobile/lib/core/config/revenuecat_config.dart).

### Price pipeline

```bash
cd services/price-pipeline
npm install
npm run dry-run  # fetch and transform without writing
npm run ingest
```

### Authentication Setup

Web and mobile share one set of sign-in providers — Apple, Google, and Discord — backed by
Supabase Auth. Provider and dashboard setup, including the `fabtrades://login-callback`
deep link mobile needs, is in [docs/AUTH_PROVIDERS.md](./docs/AUTH_PROVIDERS.md). The
Discord-specific walkthrough remains at
[docs/DISCORD_AUTH_SETUP.md](./docs/DISCORD_AUTH_SETUP.md).

**Note:** Both clients work fully without an account. Signing in adds cloud-synced
collection data and trade history.

### Cloud Sync

Binder, want list, lend groups, trades, and settings sync per account. Local storage
stays the source of truth for reads, so both clients work offline and signed out, and a
device's existing data uploads on first sign-in without the customer doing anything.
The reconciliation rules — last write wins per record, tombstoned deletes, and what
happens when a device changes hands — are in [docs/CLOUD_SYNC.md](./docs/CLOUD_SYNC.md).

### Subscriptions

FABTrades Pro is bought through the App Store or Play Store, but access itself is a row
in Postgres keyed by Supabase user — so a purchase on one platform grants Pro on all
three. A RevenueCat webhook is the only writer of that row, with a nightly job to catch
missed deliveries and lapses. Each client reads that row through one accessor —
`entitlementProvider` on mobile, `useEntitlement()` on web — so premium features flip in
a single place, and the free-tier caps both clients enforce live in
[packages/contracts/free_limits.json](./packages/contracts/free_limits.json). The design
and its setup are in [docs/ENTITLEMENTS.md](./docs/ENTITLEMENTS.md); the store-side
product and notification configuration is in
[docs/STORE_SETUP.md](./docs/STORE_SETUP.md).

## Releasing

Web deploys from `main`. Mobile ships from one tag:

```bash
git tag mobile-v1.2.0
git push origin mobile-v1.2.0
```

That drives the Android workflow; iOS is archived and uploaded to TestFlight locally in
Xcode from the same tagged commit, so the two stores carry the same code under one
version string. CI refuses a tag that disagrees with `apps/mobile/pubspec.yaml`. The full runbook, including
non-release builds against staging, is in [docs/RELEASING.md](./docs/RELEASING.md).

## License

[Add your license here]
