// Writes the voiceover script for a weekly data file.
//   node script.mjs data/week-2026-11-14.json   -> out/week-2026-11-14-script.md
// One paragraph per scene. Pause for a breath between paragraphs: the render uses those
// pauses to start each card's animation when you start talking about it.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const pct = (c) => Math.round(((c.new - c.old) / c.old) * 100);
const say = (n) => (n >= 20 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`);
const short = (name) => name.replace(/\s*\((Red|Yellow|Blue)\)/, ' $1').replace(/\s*\(.*?\)/g, '');

export function buildScript(week) {
  const first = week.cards[0];
  const month = (c) => (c.new - c.series[0]) / c.series[0];
  const lines = [];
  lines.push(`# Voiceover script: ${week.week}`, '');
  lines.push('Read one paragraph per scene and take a clear breath (about half a second) between paragraphs.');
  lines.push('Replace each [why] with one short sentence. Aim for about 30 to 40 seconds in total.', '');
  lines.push('**Hook**', '');
  lines.push(`${week.hook?.spoken ?? `This $${Math.round(first.old)} card just ${pct(first) >= 0 ? 'jumped' : 'dropped'} ${Math.abs(pct(first))} percent. Here are this week's Flesh and Blood market movers.`}`, '');
  week.cards.forEach((c, i) => {
    const p = pct(c);
    const m = month(c);
    const extra = Math.abs(m) >= 0.9 && Math.sign(m) === Math.sign(p) ? ` It was ${say(c.series[0])} a month ago.` : '';
    const lead = p < 0 && pct(week.cards[i - 1] ?? c) >= 0 && i > 0 ? 'Going down: ' : '';
    lines.push(`**${i + 1}. ${c.name}**`, '');
    lines.push(`${lead}${short(c.name)}, ${p >= 0 ? 'up' : lead ? 'off' : 'down'} ${Math.abs(p)} percent this week to ${say(c.new)}.${extra} ${c.why ?? '[why]'}`, '');
  });
  lines.push('**Sign-off**', '');
  lines.push(`${week.cta?.spoken ?? "Want to know what your binder is worth today? It's free at fabtrades dot net."}`, '');
  return lines.join('\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dataPath = process.argv[2];
  if (!dataPath) {
    console.error('Usage: node script.mjs <week.json>');
    process.exit(1);
  }
  const week = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const out = path.join(here, 'out', `${path.basename(dataPath, '.json')}-script.md`);
  fs.mkdirSync(path.dirname(out), {recursive: true});
  fs.writeFileSync(out, buildScript(week));
  console.log(out);
}
