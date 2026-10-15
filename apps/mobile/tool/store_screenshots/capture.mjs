// Captures raw app screens for the store listings from the Flutter web build.
//
//   node capture.mjs [app-url] [out-dir]
//
// The app runs in a phone-sized Chromium (430pt wide at 3x, the iPhone 6.7" /
// 6.9" logical width). Binder and Lend are seeded from seed.json through the
// same SharedPreferences keys the app uses; the trade is built through the UI.
// Every price and card image is live from Supabase, so run this somewhere that
// can reach it (the Store screenshots workflow does).
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [, , appUrl = 'http://localhost:8787/', outDir = path.join(here, 'out/raw')] = process.argv;
const seed = JSON.parse(await readFile(path.join(here, 'seed.json'), 'utf8'));
const envFile = process.env.APP_ENV_FILE ?? path.join(here, '../../env/production.json');
const appEnv = JSON.parse(await readFile(envFile, 'utf8'));

// The status bar is drawn by compose.mjs, so the app gets the space below it.
const W = 430;
const H = 932 - 54;

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  args: ['--proxy-bypass-list=localhost;127.0.0.1', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});
const context = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  // Flutter's intl throws on Chromium's default headless locale.
  locale: 'en-US',
  timezoneId: 'America/New_York',
});

// Dev hook: route Supabase to fixtures when the network can't reach it.
if (process.env.MOCK_ROUTES) {
  const { install } = await import(path.resolve(process.env.MOCK_ROUTES));
  await install(context);
}

// Flutter web decodes card art in WebGL, which needs CORS, and the card CDN
// doesn't always send the header. Fetch the art here and add it.
await context.route(/tcgplayer-cdn\.tcgplayer\.com|legendstory-production/, async (route) => {
  try {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': '*' } });
  } catch {
    await route.abort();
  }
});

const page = await context.newPage();
page.on('console', (m) => process.env.DEBUG && console.log('console:', m.text().slice(0, 200)));
page.on('pageerror', (e) => console.error('page error:', e.message.slice(0, 300)));

const settle = (ms = 1500) => page.waitForTimeout(ms);

// Card art loads lazily from the CDN; track it so captures wait for it.
const pendingImages = new Set();
const isImage = (r) => r.resourceType() === 'image' || /\.(jpe?g|png|webp)(\?|$)/.test(r.url());
page.on('request', (r) => isImage(r) && pendingImages.add(r));
page.on('requestfinished', (r) => pendingImages.delete(r));
page.on('requestfailed', (r) => pendingImages.delete(r));

async function imagesLoaded(timeout = 30000) {
  const end = Date.now() + timeout;
  let quietSince = Date.now();
  while (Date.now() < end) {
    if (pendingImages.size) quietSince = Date.now();
    else if (Date.now() - quietSince > 2000) return;
    await page.waitForTimeout(250);
  }
  console.warn(`images still loading after ${timeout}ms`);
}

async function shot(name) {
  await settle(1000);
  await imagesLoaded();
  // One more beat for decoded images to paint.
  await settle(1500);
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file });
  console.log('captured', file);
}

async function boot() {
  await page.locator('flutter-view').waitFor({ state: 'attached', timeout: 60000 });
  // The catalog downloads on first launch; wait for it and the first images.
  await settle(Number(process.env.BOOT_WAIT ?? 20000));
  // Turn on Flutter's semantics tree so widgets can be found by their labels.
  await page.evaluate(() => document.querySelector('flt-semantics-placeholder')?.click());
  await settle(1000);
}

// Taps (not clicks) so no hover tooltips are left on screen.
const button = (name) => page.getByRole('button', { name }).first();
const tab = (name) => page.getByRole('tab', { name }).first();
const result = (query, match) =>
  page.getByRole('button').filter({ hasText: query }).filter({ hasText: match }).first();

// Panels compose.mjs lifts out of the phone, in capture points.
const boxes = {};
async function recordBox(name, locator) {
  const b = await locator.boundingBox().catch(() => null);
  if (b) boxes[name] = { x: b.x, y: b.y, w: b.width, h: b.height };
  else console.warn('no breakout panel found for', name);
}

// Taps the smallest semantics node containing [text], for rows whose
// semantics role changes with what they contain.
async function tapText(text, timeout = 15000) {
  const end = Date.now() + timeout;
  while (true) {
    // Flutter puts a node's text either in its content or in aria-label.
    const nodes = await page
      .locator('flt-semantics')
      .filter({ hasText: text })
      .or(page.locator(`flt-semantics[aria-label*="${text}"]`))
      .all();
    const boxes = (await Promise.all(nodes.map((n) => n.boundingBox()))).filter((b) => b && b.width > 0);
    if (boxes.length) {
      const b = boxes.sort((a, c) => a.width * a.height - c.width * c.height)[0];
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      return;
    }
    if (Date.now() > end) {
      const labels = await page.evaluate(() =>
        [...document.querySelectorAll('flt-semantics')]
          .map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 40))
          .filter(Boolean),
      );
      throw new Error(`nothing on screen says "${text}"; saw: ${JSON.stringify(labels.slice(0, 30))}`);
    }
    await page.waitForTimeout(500);
  }
}

async function search(query) {
  await page.keyboard.type(query);
  await settle(2000);
}

// --- Seed local data -------------------------------------------------------

await page.goto(appUrl);
await page.locator('flutter-view').waitFor({ state: 'attached', timeout: 60000 });

const ids = [...seed.binder.map((e) => e.id), ...seed.lend.flatMap((g) => g.items.map((i) => i.id))];
const rows = await page.evaluate(
  async ({ url, key, ids }) => {
    const res = await fetch(
      `${url}/rest/v1/fab_cards_with_prices?select=*&id=in.(${ids.map(encodeURIComponent).join(',')})`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) throw new Error(`card lookup failed: ${res.status}`);
    return res.json();
  },
  { url: appEnv.SUPABASE_URL, key: appEnv.SUPABASE_PUBLISHABLE_KEY, ids },
);
const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
const missing = ids.filter((id) => !byId[id]);
if (missing.length) console.warn('seed cards not found:', missing.join(', '));

await page.evaluate(
  ({ seed, byId }) => {
    const now = Date.now();
    const iso = (daysAgo) => new Date(now - daysAgo * 86400000).toISOString();
    // shared_preferences_web stores each value JSON-encoded under "flutter.".
    const put = (key, value) => localStorage.setItem(`flutter.${key}`, JSON.stringify(JSON.stringify(value)));
    const card = (id) => byId[id];

    put('onboarding_v1', ['binder', 'lend', 'scan', 'trade', 'want_list', 'welcome']);
    put(
      'collection_entries',
      seed.binder
        .filter((e) => card(e.id))
        .map((e, i) => ({
          card: card(e.id),
          quantity: e.quantity ?? 1,
          condition: 'NM',
          is_wanted: false,
          added_at: iso(i + 1),
          binder_id: 'system:trade',
        })),
    );
    put(
      'lend_groups',
      seed.lend.map((g, i) => ({
        id: `seed-${i}`,
        person_name: g.person,
        is_borrowing: false,
        created_at: iso(g.daysAgo ?? 3),
        items: g.items.filter((it) => card(it.id)).map((it) => ({ card: card(it.id), quantity: it.quantity ?? 1 })),
      })),
    );
  },
  { seed, byId },
);
await page.reload();
await boot();

if (process.env.EXPLORE) {
  const { explore } = await import(path.resolve(process.env.EXPLORE));
  await explore(page, { shot, settle });
  process.exit(0);
}

// --- Screens --------------------------------------------------------------

// 02 Balance fair trades
await tab('Trade').tap();
await settle();
for (const [side, picks] of [
  ['Add their cards', seed.trade.their],
  ['Add my cards', seed.trade.mine],
]) {
  for (const pick of picks) {
    await button(side).tap();
    await settle();
    await search(pick.query);
    await result(pick.query, pick.match).tap();
    await settle(800);
    await button('Done').tap();
    await settle();
  }
}
await shot('02-trade');
await recordBox('02-trade', button(/^Trade balance/));

// 03 Browse live prices
await tab('Home').tap();
await settle();
await page.getByRole('textbox').first().tap();
await search(seed.cardDetail.query);
await result(seed.cardDetail.query, seed.cardDetail.match).tap();
await settle(4000);
await shot('03-browse');
await button('Back').tap();
await settle();

// 04 Build your binder
await tab('Binder').tap();
await settle();
await page.getByRole('group', { name: /^Trade Binder/ }).first().tap();
await settle(3000);
await shot('04-binder');
await button('Back').tap().catch(() => {});
await settle();

// 05 Track every loan
try {
  await tab('Lend').tap();
  await settle();
  await tapText(seed.lend[0].person);
  await settle(3000);
  await shot('05-lend');
  // The value card has no semantics node of its own, so grow its label's box
  // out to the card (full width, two lines tall).
  {
    const label = await page.locator('flt-semantics').filter({ hasText: /^Lent out value/ }).last().boundingBox();
    if (label) boxes['05-lend'] = { x: 8, y: label.y - 14, w: W - 16, h: 68 };
    else console.warn('no breakout panel found for 05-lend');
  }
} catch (e) {
  // Keep the other screens; leave a picture of what the screen looked like.
  console.error('05-lend failed:', e.message);
  await shot('debug-05-lend');
  process.exitCode = 1;
}

await writeFile(path.join(outDir, 'boxes.json'), JSON.stringify(boxes, null, 2));
await browser.close();
