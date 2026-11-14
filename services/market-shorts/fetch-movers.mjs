// Builds this week's data file from the FAB price history.
//   SUPABASE_URL=... SUPABASE_ANON_KEY=... node fetch-movers.mjs   -> data/week-YYYY-MM-DD.json
// Read only. Uses the same public (anon) key as the website.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pickMovers} from './pick-movers.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_ANON_KEY (the values the web app uses).');
  process.exit(1);
}

async function get(query) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${url}/rest/v1/${query}`, {
      headers: {apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}`},
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}
const iso = (d) => d.toISOString().slice(0, 10);
const back = (date, n) => iso(new Date(new Date(date).getTime() - n * 864e5));
const MIN_PRICE = 5;

// 1. Latest day and the day a week before it.
const [{captured_on: latest}] = await get('fab_price_history?select=captured_on&order=captured_on.desc&limit=1');
const weekAgo = back(latest, 7);
const day = (d) => get(`fab_price_history?select=card_id,tcg_market&captured_on=eq.${d}&tcg_market=gte.${MIN_PRICE * 0.4}`);
const [now, then] = await Promise.all([day(latest), day(weekAgo)]);
const was = new Map(then.map((r) => [r.card_id, Number(r.tcg_market)]));

// 2. Shortlist the biggest raw moves either way, then load 30 days of history for those only.
const moved = now
  .map((r) => ({id: r.card_id, pct: (Number(r.tcg_market) - was.get(r.card_id)) / was.get(r.card_id)}))
  .filter((r) => Number.isFinite(r.pct) && was.get(r.id) >= MIN_PRICE)
  .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
const shortlist = [...moved.filter((r) => r.pct > 0).slice(0, 40), ...moved.filter((r) => r.pct < 0).slice(0, 40)].map((r) => r.id);
const inList = `in.(${shortlist.map((id) => `"${id}"`).join(',')})`;
const [history, cards, sets] = await Promise.all([
  get(`fab_price_history?select=card_id,captured_on,tcg_market&card_id=${inList}&captured_on=gte.${back(latest, 30)}&order=captured_on.asc`),
  get(`fab_cards?select=id,name,sub_type_name,rarity,is_sealed,set_id,product_id&id=${inList}`),
  get('fab_sets?select=group_id,name'),
]);
const setName = new Map(sets.map((s) => [s.group_id, s.name]));
const finish = (s) => (s === 'Normal' ? 'Non-foil' : s);

const rows = cards.map((c) => ({
  id: c.id,
  name: c.name,
  printing: c.is_sealed ? 'Sealed product' : [setName.get(c.set_id), c.rarity, finish(c.sub_type_name)].filter(Boolean).join(' · '),
  img: `https://tcgplayer-cdn.tcgplayer.com/product/${c.product_id}_in_1000x1000.jpg`,
  series: history.filter((h) => h.card_id === c.id).map((h) => Number(h.tcg_market)),
}));

const fmt = (d) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'});
const week = {
  week: `${fmt(weekAgo)} to ${fmt(latest)}, ${latest.slice(0, 4)}`,
  source: 'TCGplayer market price (actual sales), tracked daily by FAB Trades',
  cards: pickMovers(rows, {minPrice: MIN_PRICE}),
};
const out = path.join(here, 'data', `week-${latest}.json`);
fs.writeFileSync(out, JSON.stringify(week, null, 2) + '\n');
console.log(out);
for (const c of week.cards) console.log(`  ${c.tag.padEnd(15)} ${c.name}  $${c.old} -> $${c.new}`);
