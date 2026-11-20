# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Flesh and Blood TCG players making trades — in person at a table or event, and via Discord "want to trade" posts. They are mid-trade or preparing one, and need to know quickly whether a proposed stack of cards is fair. Anonymous use is the norm; Discord sign-in exists only to save trade history on the web.

## Product Purpose

FAB Trades (fabtrades.net) is a free, fan-made trade balancer and price guide for Flesh and Blood. Users stack "Cards I Have" against "Cards I Want", see market/low totals and the value difference, browse set and card prices, and (on mobile) manage a Binder, Want List, lends, and scan physical cards. Success is a trade closed confidently and fast, with both sides agreeing it was fair.

## Positioning

Speed at the table. FAB Trades is the fastest way to stack two piles of cards and see the diff mid-trade — faster than looking cards up one by one on TCGplayer or wrangling a generic calculator. Everything else (history, binder, scan) serves that core moment.

## Operating Context

- Trades happen live: across a table at a store or event, or asynchronously in Discord trade channels (the web app generates Discord-ready trade-offer text and shareable URLs).
- Prices come from TCGplayer data ingested into a shared Supabase catalog (`services/price-pipeline/`, `npm run ingest`); both web and mobile read the same catalog.
- Two client surfaces: React 19 + Vite web app (`apps/web/`, deployed to Netlify) and a Flutter Android/iOS app (`apps/mobile/`, bundle `com.fabtrades.app`). The user treats web and native mobile as **equal peers sharing one design language** — the platform value `web` above records that the design language is a single brand-driven system, not OS-adaptive; neither surface is subordinate.
- Mobile adds camera-based card scanning (pHash + ML Kit OCR, on-device) for building trades from physical cards.

## Capabilities and Constraints

- Web routes: `/` trade calculator, `/history` (Discord auth), `/sets` and `/sets/:groupId` price browsing, `/privacy`, `/terms`.
- Mobile: catalog browsing, trade balancer + history, Binder, Want List, Lend tracking, card scan, theming — all local-only, no account system.
- **Durable commitment (confirmed): core features must work without an account.** Discord login stays optional and only gates saved trade history on web.
- Domain vocabulary is authoritative in `CONTEXT.md`: Binder (cards willing to trade away — not "collection"), Want List, Trade Filler, Confirm Trade (mobile), Printing (`<product_id>-<subtype>`), Condition (NM/LP/MP/HP/DMG), foil subtypes (NF/CF/RF/GF), diff, market/low price.
- Web trade history persists to Supabase `trades` table (`have_list`, `want_list`, totals).
- Not affiliated with Legend Story Studios or TCGplayer (stated in privacy policy); card images and set logos come from official FAB CDNs.
- Open decisions (not confirmed as durable commitments): whether "free forever", the visibility of the non-affiliation disclaimer, and mobile's local-only privacy stance are binding constraints on future work.

## Brand Commitments

Name: **FAB Trades**, domain fabtrades.net. Mark: `public/image.svg`. Contact: mxbloombusiness@gmail.com. No further identity constraints were made binding during init.

## Evidence on Hand

- Real catalog and price data in Supabase, plus legacy CSVs in `public/price-guide/` and `productgroups.json`.
- Set logos via `fab_sets.logo_url` (our copies in the `set-logos` Storage bucket, filled by the price pipeline from `services/price-pipeline/set-logos.json`), falling back to the bundled `setLogos.json` (cdn.fabtcg.com), then the set name; card images from official FAB CDN.
- Privacy policy at `src/content/privacyPolicy.js` (effective July 15, 2026) with GDPR/CCPA and children's-privacy language.
- No testimonials, case studies, or press exist — future work must not fabricate any.
- Stale docs: root `README.md` (CSV-era) and `mobile/README.md` ("Flutter not started") lag the implementation; prefer `CONTEXT.md` and `mobile/context.md`.

## Product Principles

1. **The table is the deadline.** Every core flow is judged by how fast a player mid-trade gets from two piles to a trustworthy diff.
2. **No gate before value.** Anyone can balance a trade and check prices without signing in; accounts only add convenience, never access.
3. **One design language, two surfaces.** Web and mobile are peers; a decision made on one must feel native to the brand on the other.
4. **Speak the trader's language.** Use the confirmed vocabulary (Binder, Want List, diff, Printing) consistently; never rename domain terms per surface.
5. **Real prices or nothing.** Values trace to the ingested TCGplayer catalog; the product never invents or estimates numbers it can't source.
