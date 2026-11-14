export type Mover = {
  tag: string; // "BIGGEST RISER", "FALLER", ...
  name: string;
  printing: string; // "The Hunted · Majestic · Non-foil"
  img: string | null; // remote URL, or a file under public/ once render.mjs has cached it
  old: number; // price a week ago
  new: number; // price now
  series: number[]; // daily prices, oldest first (about 30 days)
  why?: string; // optional one-line reason shown on screen
};

export type Week = {
  week: string; // "Nov 7 to Nov 14, 2026"
  hook?: {line: string; sub?: string}; // optional override for the opening line
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
  dim: '#B9AEA2', faint: '#8A8077', up: '#3FB984', down: '#E5604D', accent: '#D8834A',
};
export const FONT = "Inter, -apple-system, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif";
export const pct = (m: Mover) => Math.round(((m.new - m.old) / m.old) * 100);
export const usd = (n: number) => '$' + (n >= 100 ? Math.round(n).toLocaleString('en-US') : n.toFixed(2));
export const round$ = (n: number) => '$' + Math.round(n);
