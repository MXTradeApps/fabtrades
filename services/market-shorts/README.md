# Market Movers Shorts

Animated 1080x1920 "FAB Market Movers" Shorts, built with [Remotion](https://www.remotion.dev) from the daily price history. The visuals follow your voiceover: each card's animation starts when you start talking about it.

## Weekly flow

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

`pick-movers.mjs` takes the biggest weekly moves in TCGplayer market price (real sales, not listings) and keeps only real ones: $5 or more a week ago, and at least two separate price changes inside the week. A single sale on a thinly traded promo moves the price once and is dropped. Default is 3 risers and 2 fallers.

Edit the data file freely before rendering: reorder or swap cards, or change the opening with `"hook": {"line": "This $6 card just jumped", "sub": "and a brand new box lost 37%"}`. An optional `"why"` on a card shows as a one-line caption under the chart.

## Card art

`render.mjs` downloads each card's image into `public/cards/` before rendering. If an image can't be downloaded, that card renders with an empty art slot and the render still finishes.

## Tests

```bash
npm test
```
