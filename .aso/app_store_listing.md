# FAB Trades — App Store Listing (v2, optimized)

Audit of the live listing (apps.apple.com/at/app/fabtrades/id6794308687, v1.0.3, Oct 2026)
and paste-ready replacement copy. Character counts are verified.

## What's holding the listing back

| Issue | Why it matters |
| --- | --- |
| App name is `FABTrades` (9 of 30 chars) | The name is the heaviest-weighted search field. "Flesh and Blood" is nowhere in an indexed field, so a player searching for it can't find you. |
| No subtitle | The subtitle is the second-heaviest field and the line people read in search results. Right now the store shows the category ("Utilities") there instead. |
| Screenshots never say "Flesh and Blood" | Someone browsing search results can't tell this is a FAB app, not a generic TCG tool. |
| Screenshot order is Balance → Scan → Browse → Binder → Lend | Fine, but none of the new features (Life Tracker, price movers, multiple binders, Fabrary import) appear in screenshots or the description. |
| Scan screenshot shows the debug bug icon in the header | Looks unfinished. |
| Zero ratings and no in-app review prompt in the code | Ratings affect both ranking and conversion; an app with none looks abandoned. |
| Category: Utilities | A crowded category, so top-chart visibility is close to impossible. |
| English metadata only | FAB is big in the EU (you already support Cardmarket EUR), but the listing has no localized keywords. |
| "Not verified for macOS" | Signals low polish when people see it on a Mac. |

## 1. App name (30)

```
FAB Trades: Flesh and Blood
```
27 chars. Puts the game's name in the strongest field. This is the single biggest win.

> Trademark risk: Apple can reject a name that uses another company's mark (Guideline 5.2.1).
> Other FAB apps already ship with it ("Flesh and Blood Counter", "FaB Scanner - Dragon Shield"),
> and your description already carries the non-affiliation disclaimer. If Review pushes back,
> fall back to `FAB Trades: TCG Trade & Prices` and move "flesh,blood" into keywords.

## 2. Subtitle (30)

Recommended (best for search):
```
TCG Card Scanner & Price Guide
```
30 chars. Covers "card scanner", "price guide" and "tcg", which are the terms players actually search.

Alternative (says more about the core use):
```
Trade Balancer, Scan & Prices
```
29 chars.

## 3. Keywords (100)

Don't repeat any word already in the name or subtitle (fab, trades, flesh, blood, tcg, card,
scanner, price, guide). Use commas with no spaces. Leave out competitor and brand names (TCGplayer,
Cardmarket, Fabrary): Guideline 2.3.7 forbids them in keywords.

```
fabtcg,trade,balancer,binder,collection,tracker,value,calculator,life,counter,wishlist,foil,armory
```
98 chars.

If you use the alternative subtitle, swap `trade,balancer` for `scanner,guide`.

## 4. Promotional text (170). You can change it at any time without App Review.

```
New: Life Tracker with Classic Constructed & Silver Age round timers, multiple binders, Fabrary import, and daily price movers. No account needed, no ads.
```
154 chars. Rewrite it for each set release, e.g. "<Set name> prices are live, updated daily."

## 5. Description

Description text isn't indexed for search on iOS, so it only affects conversion. Only the first
~3 lines show before "more", so they have to say what the app is, who it's for, and why it's worth it.

```
The trade app for Flesh and Blood players. Scan a card, see what it's worth, and know a trade is fair before you shake on it. No account needed.

Whether you're trading at Armory night, a Calling, or a Pro Tour, FAB Trades makes every trade fair, fast, and informed.

BALANCE ANY TRADE IN SECONDS
Add cards to each side and watch the totals update live. See who's up, who's down, and by how much. Trade close but not quite even? Tap Find Trade Filler and FAB Trades suggests cards from your Binder and Want List to close the gap.

SCAN CARDS WITH YOUR CAMERA
Point your camera at a card and FAB Trades identifies it automatically. No shutter button, no typing.

REAL MARKET PRICES, UPDATED DAILY
TCGplayer (USD) and Cardmarket (EUR) prices, refreshed every day. Compare Market, Low, Mid and High across every printing (Normal, Rainbow Foil, Cold Foil, alternate arts) and check price history before you deal. Home opens on the biggest recent gainers and losers.

YOUR BINDERS, DIGITIZED
Trade Binder, Collection, and as many binders as you like, each with its total value and recent movers. Build a Want List and hand your phone across the table so the other player can check it against their binder. Confirm a trade and your binders update automatically. Already on Fabrary? Import your collection CSV in seconds.

LIFE TRACKER FOR THE TABLE
A two-player life counter with a change log and a round timer for Classic Constructed (55:00) and Silver Age (35:00).

NEVER LOSE TRACK OF A LOAN
Lent a friend a deck? Borrowed a Cold Foil for a tournament? The Lend tab tracks every card going out or coming in, by person, with running values.

BROWSE THE FULL CATALOG
Every set from Welcome to Rathe to the latest release, with official set logos. Search everything, filter foils, and sort by name, price or collector number.

ALSO INCLUDES
• Trade history
• Switch between USD and EUR
• Condition grades (NM, LP, MP, HP, DMG)
• Dark mode
• Instant startup with offline-friendly catalog caching

Questions or ideas? We read every message: mxbloombusiness@gmail.com

FAB Trades is a fan-made app. Not affiliated with Legend Story Studios, TCGplayer or Cardmarket. Card names and images are property of their respective owners.

Terms of Use (EULA): https://fabtrades.net/terms
Privacy Policy: https://fabtrades.net/privacy
```

Keep the Terms URL. App Review requires it because of the subscriptions (see `docs/STORE_SETUP.md`).

> "No account needed" is true today and is a durable commitment in `docs/PRODUCT.md`.
> Don't put "100% free" in the description: the listing shows In-App Purchases, and
> `unlockAllFeatures` in `apps/mobile/lib/core/logic/feature_access.dart` is temporary.
> Say "free" in promotional text instead, where you can pull it back without a review.

## 6. Screenshots

Most people decide from the first three, which are what search results show. Recommended set (6.9" 1320×2868 / 6.7" 1290×2796):

| # | Caption (top / bottom) | Screen |
| --- | --- | --- |
| 1 | **THE FLESH AND BLOOD TRADE APP** / Know it's fair before you shake | Balanced trade with a recognisable high-value Cold Foil and the +$ diff visible |
| 2 | **SCAN ANY CARD** / Instant prices, no typing | Scan result sheet (remove the debug bug icon) |
| 3 | **CLOSE THE GAP** / Find Trade Filler suggests cards | Trade Filler sheet (currently unused, and your most unusual feature) |
| 4 | **DAILY PRICES** / TCGplayer & Cardmarket | Home: recent movers |
| 5 | **ALL YOUR BINDERS** / Values update on every trade | New binder grid |
| 6 | **LIFE TRACKER** / CC & Silver Age timers | Life Tracker |
| 7 | **TRACK EVERY LOAN** | Lend |
| 8 | **IMPORT FROM FABRARY** | Import preview |

- Put the words "Flesh and Blood" on screenshot 1. Apple now OCRs screenshot captions and may use them in ranking, and it's how browsers know what the app is.
- Use recognisable chase cards (Cold Foil legendaries, hero cards), not $0.45 commons.
- Add iPad screenshots if you haven't. The app is marked "Designed for iPad".
- An app preview video (15–30s: scan, then trade balances, then confirm) autoplays in search and usually lifts conversion.

## 7. Category

Move the primary category from **Utilities** to **Reference**. It's where card-database and price-guide apps
cluster and it has far less competition for top-chart spots. Set **Utilities** as the secondary.
Watch impressions in App Analytics for 2–3 weeks and switch back if they drop.

## 8. Ratings (the biggest gap after the name)

- Add `in_app_review` (`requestReview()`) after a positive moment, e.g. the 3rd confirmed trade or
  the 2nd scan that matches. Never after an error, and never on first launch. iOS caps the prompt at 3 times a year.
- Reply to every review in App Store Connect. That's visible and raises re-rating rates.
- Don't reset the rating summary when you ship. You have none to protect yet.

## 9. Localization (more keyword fields at no cost)

You can add localized metadata without translating the app. Priority: **German, French, Italian,
Spanish (Spain), Dutch, Polish**, which are FAB/Cardmarket markets. Each locale gets its own 30/30/100 fields.
- In the US storefront, Apple also indexes the **Spanish (Mexico)** locale. Use its keyword field for
  more English terms (e.g. `deck,hero,singles,rainbow,cold,marvel,sealed,worth,fair,checker`).
- In the description, say the app UI is in English so nobody leaves a 1-star review over it.

## 10. Other adoption levers

- **In-App Events** (App Store Connect → In-App Events): one per set release ("<Set> prices are live")
  and for big events (Calling/Pro Tour weekends). Events show up in search and on the product page, and are
  one of the few free discovery surfaces left.
- **Custom Product Pages**: one for Discord/Reddit links that leads with the trade balancer, one for
  scan-focused posts. Attribute installs per link.
- **Smart App Banner** on fabtrades.net: done in this change (`apps/web/index.html`). It covers every
  prerendered set price page, so your SEO traffic now gets a one-tap install prompt on iPhone.
- **Apple Search Ads** on `flesh and blood`, `fab tcg`, `fab card scanner`, `fab price`. Niche terms with
  few bidders, so they're likely cheap. Start at €5/day.
- **Mac**: either untick "Make available on Mac" or test it once. "Not verified for macOS" reads as neglect.
- **What's New**: keep bullets consistent. The current 1.0.3 notes mix "- " and plain lines.
- **Community**: a QR code card for Armory store counters, posts on r/FleshandBloodTCG for each release.
