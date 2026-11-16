// Renders a Market Movers Short from a weekly data file.
//   node render.mjs data/sample-week.json                -> out/sample-week.mp4
//   node render.mjs data/sample-week.json voice.m4a      -> same, with your voiceover, and each
//                                                           scene starting when you start that part
//   node render.mjs data/week.json --thumbnail           -> the opening card as a PNG, for the thumbnail
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
const thumbnail = args.includes('--thumbnail');
let stillAt = args.includes('--still') ? Number(args[args.indexOf('--still') + 1] ?? 0) : null;
const week = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Voiceover: copy it next to the template and read scene start times from its pauses.
const audioPath = args.find((a) => /\.(m4a|mp3|wav|aac|mp4|mov)$/i.test(a));
if (audioPath) {
  // Run the Remotion CLI through node itself: `npx` is a .cmd file on Windows and can't be spawned directly.
  const cliDir = path.join(here, 'node_modules', '@remotion', 'cli');
  const bin = JSON.parse(fs.readFileSync(path.join(cliDir, 'package.json'), 'utf8')).bin;
  const cli = path.join(cliDir, typeof bin === 'string' ? bin : bin.remotion);
  const remotion = (...a) => {
    const r = spawnSync(process.execPath, [cli, ...a], {cwd: here, encoding: 'utf8'});
    if (r.error) throw r.error;
    return r;
  };
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
// Same image source as fabtrades.net (the TCGplayer image for the product). The site shows the
// 200px version; a full-screen video needs the large one, so try that first and fall back.
const large = (u) => u.replace(/_200w\.jpg$/, '_in_1000x1000.jpg');
for (const [i, card] of week.cards.entries()) {
  if (!card.img || !/^https?:/.test(card.img)) continue;
  const tries = [...new Set([large(card.img), card.img])];
  let saved = null, reason = '';
  for (const u of tries) {
    try {
      const res = await fetch(u, {signal: AbortSignal.timeout(15000)});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      saved = `cards/${i}-${path.basename(new URL(u).pathname)}`;
      fs.writeFileSync(path.join(here, 'public', saved), Buffer.from(await res.arrayBuffer()));
      break;
    } catch (err) {
      reason = err.message;
    }
  }
  if (!saved) console.warn(`No art for "${card.name}" (${reason}); rendering an empty slot.`);
  card.img = saved;
}

// Emphasis pictures: copy each one into public/shots so the video can load it. A picture that
// can't be found is left out with a warning instead of failing the render.
const shots = [];
for (const [i, shot] of (week.shots ?? []).entries()) {
  const from = [shot.img, path.resolve(path.dirname(dataPath), shot.img)].find((f) => fs.existsSync(f) && fs.statSync(f).isFile());
  if (!from) {
    console.warn(`No picture at "${shot.img}"; leaving that shot out.`);
    continue;
  }
  const file = `shots/${i}-${path.basename(from).replace(/[^\w.-]+/g, '_')}`;
  fs.mkdirSync(path.join(here, 'public', 'shots'), {recursive: true});
  fs.copyFileSync(from, path.join(here, 'public', file));
  shots.push({...shot, img: file});
}
week.shots = shots;

// Flesh and Blood logo for the opening card: public/fab-logo.png (or .svg / .webp).
// Without it the card shows plain text instead.
week.fabLogo = ['fab-logo.png', 'fab-logo.svg', 'fab-logo.webp'].find((f) => fs.existsSync(path.join(here, 'public', f))) ?? null;

const browserExecutable = process.env.CHROME_PATH || undefined;
const serveUrl = await bundle({entryPoint: path.join(here, 'src', 'index.ts')});
const composition = await selectComposition({serveUrl, id: 'MarketMovers', inputProps: week, browserExecutable});
const base = path.join(here, 'out', path.basename(dataPath, '.json'));
fs.mkdirSync(path.dirname(base), {recursive: true});

if (thumbnail) stillAt = Math.max(0, Math.min(45, Math.round((week.timing?.cards?.[0] ?? 3.5) * 30) - 10));
if (stillAt !== null) {
  const output = thumbnail ? `${base}-thumbnail.png` : `${base}-f${stillAt}.png`;
  await renderStill({composition, serveUrl, inputProps: week, frame: stillAt, output, browserExecutable});
  console.log(output);
} else {
  const outputLocation = `${base}.mp4`;
  await renderMedia({composition, serveUrl, inputProps: week, codec: 'h264', outputLocation, browserExecutable,
    onProgress: ({progress}) => process.stdout.write(`\r${Math.round(progress * 100)}%`)});
  console.log(`\n${outputLocation}`);
}
