# Market Movers Shorts

Animated 1080x1920 "FAB Market Movers" Shorts, built with [Remotion](https://www.remotion.dev) from the daily price history. The visuals follow your voiceover: each card's animation starts when you start talking about it.

## Weekly flow

Weekly data files and scripts are not committed: `data/*.json` is ignored except `data/sample-week.json`. Keep them on the machine you render on.

```bash
cd services/market-shorts
npm install                                   # first time only

# 1. Pick this week's movers (read only, same public key as the website)
SUPABASE_URL=... SUPABASE_ANON_KEY=... npm run movers
#    -> data/week-YYYY-MM-DD.json

# 2. Write the voiceover script
npm run script -- data/week-YYYY-MM-DD.json
#    -> out/week-YYYY-MM-DD-script.md   (fill in each [why])

# 3. Record the script as one audio file (Voice Memos is fine: .m4a, .mp3 or .wav).
#    Take a clear breath, about half a second, between paragraphs.

# 4. Render
npm run short -- data/week-YYYY-MM-DD.json ~/Desktop/voice.m4a
#    -> out/week-YYYY-MM-DD.mp4, with your audio in it
```

Then add captions in CapCut and upload.

`npm run short -- data/week.json` with no audio file renders a silent video with 5 seconds per card. `npm run studio` opens the Remotion preview.

## How the sync works

The script has one paragraph per scene: hook, each card, sign-off. The render looks for the pauses in your recording (`ffmpeg silencedetect`) and treats the longest ones as scene changes, so a short pause in the middle of a sentence is ignored. It prints the start time it found for every scene.

If it can't find enough clear pauses it stops with a message instead of rendering a badly synced video. In that case either re-record with clearer breaths, or set the times by hand in the data file (seconds from the start of the audio):

```json
"timing": { "cards": [4.0, 9.8, 14.7, 20.3, 25.1], "end": 31.3, "total": 36 }
```

## What gets picked

`pick-movers.mjs` takes the biggest weekly moves in TCGplayer market price (real sales, not listings) and keeps only real ones: $5 or more a week ago, and at least three separate price changes inside the week. A single sale on a thinly traded promo moves the price once and is dropped. Sealed product (boxes, packs, decks) and art cards are left out, so every pick is a single card. Default is 3 risers and 2 fallers.

Edit the data file freely before rendering: reorder or swap cards, or change the opening with `"hook": {"line": "This $6 card just jumped", "sub": "and one staple lost a quarter of its value"}`. An optional `"why"` on a card shows as a one-line caption under the chart.

## Other time spans and two printings

The default is a weekly video. For a shorter span, set the prices yourself (`old` is the price at the start of the span) and add:

```json
"period": { "days": 2, "ago": "2 days ago", "recent": "last 2 days" }
```

The slide then says "was $28.00 2 days ago" and the chart shades the last 2 days.

A card can say which price it shows with `"priceLabel": "lowest listing price"`, and can show a second printing on the same slide:

```json
"also": { "printing": "Dynasty · Majestic · Rainbow Foil", "old": 59, "new": 71.39, "series": [ ... ] }
```

Both printings get their own percent and price, and the second one is drawn as a dotted line on the same chart.

## Emphasis pictures

To show a picture over the middle of the video for a few seconds (a stream screenshot, a stats graphic):

```json
"shots": [ { "at": 21.5, "dur": 4, "img": "C:/path/to/screenshot.png", "caption": "Top 8 at Calling Sydney" } ]
```

`at` is the second it appears, `dur` how long it stays (4 seconds if left out). `img` is a file on your computer; a path relative to the data file works too. `caption` is optional. The picture is sized to fill the middle of the frame, so crop it to what matters first.

## YouTube Shorts safe zone

Shorts covers the top of the video with its own bar, the bottom with the title, channel and caption, and the lower right with its buttons. Every screen keeps its content inside the area that stays visible (`SAFE` in `src/types.ts`): nothing important above 190px, below 1470px, or right of 920px in the lower half.

## Opening card and thumbnail

Add your own words for the opening card to the data file:

```json
"thumbnail": { "lines": ["Perforate", "up 69%", "in one week!"], "card": 0, "highlight": 2 }
```

The video then opens on a card with the Flesh and Blood logo, the FAB Trades logo top right, that card's art, and your words in big outlined type over it. `card` is which card's art to use (0 is the first) and `highlight` is the line that gets the accent colour (the last one by default). Each line is sized to fit, so shorter lines come out bigger.

`npm run thumbnail -- data/week-YYYY-MM-DD.json` saves the same card as `out/week-YYYY-MM-DD-thumbnail.png`.

The Flesh and Blood logo on the card is `public/fab-logo.png`. Replace that file to change it (a larger or `.svg` version will look sharper).

Without a `thumbnail` block the video opens on the percent hook instead.

An optional second opening screen can follow it, timed to your intro line:

```json
"intro": { "at": 5.3, "lines": ["Biggest", "Gainers", "& Losers"], "sub": "Week of November 15" }
```

`at` is the second it appears; it stays until the first card. It shows the lines in big type, the smaller line under them, and every card's art in a row.

## Card art

Art comes from the same place as fabtrades.net: the `image_url` on each card (TCGplayer's product image). The site shows the 200px version, so `render.mjs` asks for the 1000px version of the same image first, falls back to the 200px one, and saves it into `public/cards/` before rendering. If an image can't be downloaded, that card renders with an empty art slot and the render still finishes.

## Tests

```bash
npm test
```
