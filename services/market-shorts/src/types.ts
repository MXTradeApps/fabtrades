export type Mover = {
  tag: string; // "BIGGEST RISER", "FALLER", ...
  name: string;
  printing: string; // "The Hunted · Majestic · Non-foil"
  img: string | null; // remote URL, or a file under public/ once render.mjs has cached it
  old: number; // price a week ago
  new: number; // price now
  series: number[]; // daily prices, oldest first (about 30 days)
  why?: string; // optional one-line reason shown on screen
  priceLabel?: string; // which price this is, shown under it, e.g. "lowest listing"
  // A second printing of the same card on the same slide (e.g. the foil next to the non-foil).
  also?: {printing: string; old: number; new: number; series?: number[]};
};

export type Week = {
  week: string; // "Nov 7 to Nov 14, 2026"
  hook?: {line: string; sub?: string}; // optional override for the opening line
  // Opening card that doubles as the thumbnail: your words in big type over a card's art.
  // `card` is which card's art to use (0 = first), `highlight` which line gets the accent colour (default: last).
  thumbnail?: {lines: string[]; highlight?: number; card?: number};
  // How far back "old" is. Default is a week. For a 2-day video: {"days": 2, "ago": "2 days ago", "recent": "last 2 days"}.
  period?: {days: number; ago: string; recent: string};
  // Optional second opening screen, shown from `at` seconds until the first card: big title
  // lines, a smaller line under them, and every card's art in a row.
  intro?: {at: number; lines: string[]; sub?: string};
  // Pictures shown over the lower part of the video for emphasis (e.g. a stream screenshot).
  // `at` is the second it appears, `dur` how long it stays (default 4), `img` a picture file:
  // a path on your computer, or a file under public/ once render.mjs has copied it.
  shots?: {at: number; dur?: number; img: string; caption?: string}[];
  fabLogo?: string | null; // Flesh and Blood logo under public/, set by render.mjs when the file exists
  cta?: {question: string; url: string; foot: string};
  cards: Mover[];
  audio?: string | null; // voiceover file under public/, set by render.mjs
  // Scene start times in seconds, matched to the voiceover. Written by render.mjs from the
  // pauses in the recording, or set by hand. Without it every scene uses the default length.
  timing?: {cards: number[]; end: number; total: number};
};

export const FPS = 30;
export const HOOK = 105; // 3.5s
export const CARD = 150; // 5s per card
export const END = 105; // 3.5s

/** Where each scene starts and how long it runs, in frames. */
export function layout(w: Week) {
  const n = w.cards.length;
  const t = w.timing;
  const ok = t && t.cards.length === n;
  const starts = ok ? t.cards.map((s) => Math.round(s * FPS)) : w.cards.map((_, i) => HOOK + i * CARD);
  const end = ok ? Math.round(t.end * FPS) : HOOK + n * CARD;
  const total = ok ? Math.round(t.total * FPS) : end + END;
  return {
    hook: {from: 0, dur: starts[0] ?? end},
    cards: starts.map((from, i) => ({from, dur: (starts[i + 1] ?? end) - from})),
    end: {from: end, dur: total - end},
    total,
  };
}
export const totalFrames = (w: Week) => layout(w).total;

export const C = {
  bg: '#131110', panel: '#221E1B', line: '#3A342F', text: '#F4EFE9',
  dim: '#B9AEA2', faint: '#8A8077', up: '#3FB984', down: '#E5604D', accent: '#D8834A', accentText: '#F2B27E',
};
export const FONT = "'Inter Shorts', Inter, -apple-system, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif";
export const pct = (m: Mover) => Math.round(((m.new - m.old) / m.old) * 100);
export const usd = (n: number) => '$' + (n >= 100 ? Math.round(n).toLocaleString('en-US') : n.toFixed(2));
export const round$ = (n: number) => '$' + Math.round(n);

/**
 * The part of the 1080x1920 frame that YouTube Shorts leaves uncovered. The app draws its
 * own bar over the top, the title, channel and caption over the bottom, and a column of
 * buttons down the right of the lower half. Everything that matters stays above `bottom`,
 * below `top`, and (in the lower half) left of `rail`.
 */
export const SAFE = {top: 190, bottom: 1470, rail: 920};
