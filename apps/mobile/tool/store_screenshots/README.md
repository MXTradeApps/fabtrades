# Store screenshots

Regenerates the App Store and Google Play screenshots from the current UI, so the
listing can be refreshed whenever the app changes.

Run it from GitHub: **Actions → Store screenshots → Run workflow**. The workflow
builds the Flutter app for the web, drives it in a phone-sized Chromium with live
Supabase prices and card art, frames each screen, and commits the results to the
branch it ran on:

| Output | Size | Store slot |
| --- | --- | --- |
| `screenshots/final/*.jpg` | 1290×2796 | App Store, iPhone 6.9" / 6.7" |
| `screenshots/final/play/*.jpg` | 1080×1920 | Google Play, phone |

It does not upload anything to either store.

## Pieces

- `capture.mjs` boots the web build, seeds Binder and Lend from `seed.json` through
  the app's own SharedPreferences keys, builds a trade through the UI, and saves raw
  430×878pt captures (3x) plus the panels to lift out of the phone (`boxes.json`).
- `compose.mjs` puts each capture under a headline on the brand background, in an
  iPhone frame for the App Store and a generic phone for Play, with a drawn status bar.
- `seed.json` picks the cards. Use recognisable, high-value printings, and for the
  trade pick two whose Low prices are a couple of dollars apart so the balance reads
  as fair. Card ids are `fab_cards_with_prices.id`.

## Limits

- **Scan** can't be captured: the scanner needs a real camera and ML Kit, neither of
  which runs on the web. Take that one on a phone (a scan with the match sheet up),
  save it as `out/raw/01-scan.png` at 1290px wide with the status bar cropped off
  (the top 162px of a 1290×2796 iPhone screenshot), and re-run `compose.mjs`.
- The web build uses Chromium's text rendering, so it is close to, but not
  pixel-identical with, the iOS build.

## Running locally

```sh
cd apps/mobile
flutter build web --release --no-web-resources-cdn --dart-define-from-file=env/production.json
(cd build/web && python3 -m http.server 8787) &
cd tool/store_screenshots
npm install && npx playwright install chromium
node capture.mjs http://localhost:8787/ out/raw
node compose.mjs out/raw out
```

Your machine needs to reach Supabase and `tcgplayer-cdn.tcgplayer.com`.
