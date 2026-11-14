// Renders a Market Movers Short from a weekly data file.
//   node render.mjs data/week-2026-11-14.json            -> out/week-2026-11-14.mp4
//   node render.mjs data/week-2026-11-14.json voice.m4a  -> same, with your voiceover, and each
//                                                           scene starting when you start that part
//   node render.mjs data/week.json --still 60            -> one PNG frame, for a quick look
// Card art is downloaded into public/cards first. A card whose image can't be fetched
// renders with an empty art slot instead of failing the whole video.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {spawnSync} from 'node:child_process';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {parseSilences, timingFromSilences} from './timing.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dataPath = args.find((a) => !a.startsWith('--') && a.endsWith('.json'));
if (!dataPath) {
  console.error('Usage: node render.mjs <week.json> [voiceover.m4a|.mp3|.wav] [--still <frame>]');
  process.exit(1);
}
const stillAt = args.includes('--still') ? Number(args[args.indexOf('--still') + 1] ?? 0) : null;
const week = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Voiceover: copy it next to the template and read scene start times from its pauses.
const audioPath = args.find((a) => /\.(m4a|mp3|wav|aac|mp4|mov)$/i.test(a));
if (audioPath) {
  const remotion = (...a) => spawnSync('npx', ['remotion', ...a], {cwd: here, encoding: 'utf8'});
  const file = `audio/voice${path.extname(audioPath).toLowerCase()}`;
  fs.mkdirSync(path.join(here, 'public', 'audio'), {recursive: true});
  fs.copyFileSync(audioPath, path.join(here, 'public', file));
  week.audio = file;
  const duration = Number(remotion('ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', audioPath).stdout.trim());
  if (!Number.isFinite(duration)) throw new Error(`Could not read ${audioPath}`);
  if (week.timing) {
    console.log('Using the "timing" set in the data file.');
  } else {
    const log = remotion('ffmpeg', '-hide_banner', '-i', audioPath, '-af', 'silencedetect=noise=-32dB:d=0.3', '-f', 'null', '-').stderr;
    week.timing = timingFromSilences(parseSilences(log), duration, week.cards.length);
  }
  week.timing.total = Math.max(week.timing.total, duration + 0.3);
  const t = week.timing;
  console.log(`Voiceover ${duration.toFixed(1)}s. Scenes start at: hook 0s, ${t.cards.map((s, i) => `card ${i + 1} ${s}s`).join(', ')}, sign-off ${t.end}s.`);
}

const cardsDir = path.join(here, 'public', 'cards');
fs.mkdirSync(cardsDir, {recursive: true});
for (const [i, card] of week.cards.entries()) {
  if (!card.img || !/^https?:/.test(card.img)) continue;
  const file = `cards/${i}-${path.basename(new URL(card.img).pathname)}`;
  try {
    const res = await fetch(card.img, {signal: AbortSignal.timeout(15000)});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fs.writeFileSync(path.join(here, 'public', file), Buffer.from(await res.arrayBuffer()));
    card.img = file;
  } catch (err) {
    console.warn(`No art for "${card.name}" (${err.message}); rendering an empty slot.`);
    card.img = null;
  }
}

const browserExecutable = process.env.CHROME_PATH || undefined;
const serveUrl = await bundle({entryPoint: path.join(here, 'src', 'index.ts')});
const composition = await selectComposition({serveUrl, id: 'MarketMovers', inputProps: week, browserExecutable});
const base = path.join(here, 'out', path.basename(dataPath, '.json'));
fs.mkdirSync(path.dirname(base), {recursive: true});

if (stillAt !== null) {
  const output = `${base}-f${stillAt}.png`;
  await renderStill({composition, serveUrl, inputProps: week, frame: stillAt, output, browserExecutable});
  console.log(output);
} else {
  const outputLocation = `${base}.mp4`;
  await renderMedia({composition, serveUrl, inputProps: week, codec: 'h264', outputLocation, browserExecutable,
    onProgress: ({progress}) => process.stdout.write(`\r${Math.round(progress * 100)}%`)});
  console.log(`\n${outputLocation}`);
}
