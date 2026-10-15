// Frames the raw captures from capture.mjs into store screenshots: a headline
// on the brand background over the screen in a phone frame, with one panel
// "breaking out" of the phone where capture.mjs recorded one.
//
//   node compose.mjs [raw-dir] [out-dir]
//
// Writes <out-dir>/ios/*.jpg at 1290x2796 (App Store 6.7"/6.9" iPhone) and
// <out-dir>/android/*.jpg at 1080x1920 (Google Play phone).
import { chromium } from 'playwright';
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const [, , rawDir = path.join(here, 'out/raw'), outDir = path.join(here, 'out')] = process.argv;

const BRAND = '#8B4513';
const STATUS_BAR = 54; // points; matches the height capture.mjs leaves free

// Same captions and order as the previous listing.
// Scan needs a real camera, so it comes from a phone screenshot kept next to
// this script (see README), with the match results lifted out.
const screens = [
  {
    raw: '01-scan',
    out: '01-scan-cards-instantly',
    title: ['SCAN', 'CARDS INSTANTLY'],
    fallback: 'scan.png',
    box: { x: 8, y: 428, w: 414, h: 176 },
  },
  { raw: '02-trade', out: '02-balance-fair-trades', title: ['BALANCE', 'FAIR TRADES'] },
  { raw: '03-browse', out: '03-browse-live-prices', title: ['BROWSE', 'LIVE PRICES'] },
  { raw: '04-binder', out: '04-build-your-binder', title: ['BUILD', 'YOUR BINDER'] },
  { raw: '05-lend', out: '05-track-every-loan', title: ['TRACK', 'EVERY LOAN'] },
];

// Canvas sizes in points; rendered at 3x.
const targets = [
  { dir: 'ios', width: 430, height: 932, device: 'iphone' },
  { dir: 'android', width: 360, height: 640, device: 'android' },
];

const exists = (p) => access(p).then(() => true, () => false);
const boxesFile = path.join(rawDir, 'boxes.json');
const boxes = (await exists(boxesFile)) ? JSON.parse(await readFile(boxesFile, 'utf8')) : {};

function html({ width, height, device }, screen, dataUrl, box) {
  // Phone geometry, in canvas points. The screen keeps the capture's aspect.
  const screenW = device === 'iphone' ? 300 : 200;
  const screenH = (screenW * 932) / 430;
  const bezel = device === 'iphone' ? 9 : 7;
  const radius = device === 'iphone' ? 46 : 30;
  const phoneW = screenW + bezel * 2;
  const phoneH = screenH + bezel * 2;
  const phoneTop = device === 'iphone' ? 226 : 168;
  const phoneLeft = (width - phoneW) / 2;
  const k = screenW / 430; // capture points -> canvas points
  const big = device === 'iphone' ? 88 : 66;
  const small = device === 'iphone' ? 44 : 32;

  let breakout = '';
  if (box) {
    // Recorded boxes hug the panel's content; take in its padding too.
    const pad = 10;
    const x0 = Math.max(0, box.x - pad);
    const y0 = Math.max(0, box.y - pad);
    box = { x: x0, y: y0, w: Math.min(430, box.x + box.w + pad) - x0, h: box.h + (box.y - y0) + pad };
    // Lift the recorded panel out of the phone: wider than the screen,
    // centred on where it sits, with a drop shadow.
    const scale = (width - 28) / (box.w * k);
    const w = box.w * k * scale;
    const h = box.h * k * scale;
    const cy = phoneTop + bezel + (STATUS_BAR + box.y + box.h / 2) * k;
    const bgW = 430 * k * scale;
    const bgH = (932 - STATUS_BAR) * k * scale;
    breakout = `<div class="breakout" style="left:${(width - w) / 2}px;top:${cy - h / 2}px;width:${w}px;height:${h}px;
      background-image:url(${dataUrl});background-size:${bgW}px ${bgH}px;
      background-position:${-box.x * k * scale}px ${-box.y * k * scale}px"></div>`;
  }

  const island =
    device === 'iphone'
      ? `<div class="island"></div>`
      : `<div class="punch"></div>`;
  const statusLeft = device === 'iphone' ? '9:41' : '9:41';

  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;800;900&display=block" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
  body { background: radial-gradient(120% 70% at 50% 0%, #a0561f 0%, ${BRAND} 45%, #6e370f 100%); font-family: 'Archivo', sans-serif; position: relative; }
  .title { position: absolute; top: ${device === 'iphone' ? 58 : 34}px; width: 100%; text-align: center; color: #fff; text-shadow: 0 3px 12px rgba(0,0,0,.25);
    display: flex; flex-direction: column; align-items: center; }
  .title .a { display: inline-block; white-space: nowrap; font-weight: 900; font-size: ${big}px; line-height: 1; letter-spacing: 1px; }
  .title .b { white-space: nowrap; font-weight: 800; font-size: ${small}px; line-height: 1.15; margin-top: 8px; letter-spacing: .5px; }
  .phone { position: absolute; left: ${phoneLeft}px; top: ${phoneTop}px; width: ${phoneW}px; height: ${phoneH}px;
    border-radius: ${radius + bezel}px; background: #1b1b1d; padding: ${bezel}px;
    box-shadow: 0 0 0 2px #4a4a4e, 0 0 0 3.5px #2a2a2c, 0 30px 60px rgba(0,0,0,.45); }
  .screen { position: relative; width: ${screenW}px; height: ${screenH}px; border-radius: ${radius}px; overflow: hidden; background: var(--app-bg, #121110); }
  .status { position: absolute; top: 0; left: 0; right: 0; height: ${STATUS_BAR * k}px; display: flex; align-items: center;
    justify-content: space-between; padding: 0 ${device === 'iphone' ? 30 : 18}px; color: #fff; font: 600 ${device === 'iphone' ? 13 : 10}px -apple-system, 'Archivo', sans-serif; }
  .status svg { height: ${device === 'iphone' ? 11 : 9}px; margin-left: 4px; fill: #fff; }
  .app { position: absolute; top: ${STATUS_BAR * k}px; left: 0; width: 100%; }
  .island { position: absolute; top: ${11 * k}px; left: 50%; transform: translateX(-50%); width: ${126 * k}px; height: ${37 * k}px; border-radius: 20px; background: #000; }
  .punch { position: absolute; top: ${18 * k}px; left: 50%; transform: translateX(-50%); width: ${12 * k * 1.6}px; height: ${12 * k * 1.6}px; border-radius: 50%; background: #000; }
  .breakout { position: absolute; border-radius: 16px; background-repeat: no-repeat;
    box-shadow: 0 0 0 1px rgba(255,255,255,.08), 0 24px 50px rgba(0,0,0,.55); }
</style></head><body>
  <div class="title"><div class="a">${screen.title[0]}</div><div class="b">${screen.title[1]}</div></div>
  <div class="phone"><div class="screen">
    <div class="status"><span>${statusLeft}</span><span>
      <svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>
      <svg viewBox="0 0 16 12"><path d="M8 2.2c2.4 0 4.6.9 6.3 2.5l1.2-1.3C13.5 1.4 10.9.4 8 .4S2.5 1.4.5 3.4l1.2 1.3C3.4 3.1 5.6 2.2 8 2.2zm0 3.6c1.4 0 2.7.5 3.7 1.4l1.2-1.3C11.6 4.7 9.9 4 8 4s-3.6.7-4.9 1.9l1.2 1.3c1-.9 2.3-1.4 3.7-1.4zM8 9.4c-.6 0-1.1.2-1.5.6L8 11.6 9.5 10c-.4-.4-.9-.6-1.5-.6z"/></svg>
      <svg viewBox="0 0 27 12"><rect x=".5" y=".5" width="23" height="11" rx="3" fill="none" stroke="#fff" stroke-opacity=".5"/><rect x="2" y="2" width="20" height="8" rx="1.8"/><rect x="24.5" y="4" width="1.8" height="4" rx=".9" fill-opacity=".5"/></svg>
    </span></div>
    ${island}
    <img class="app" src="${dataUrl}">
  </div></div>
  ${breakout}
</body></html>`;
}

const browser = await chromium.launch({
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
});

for (const target of targets) {
  const dir = path.join(outDir, target.dir);
  await mkdir(dir, { recursive: true });
  const page = await browser.newPage({
    viewport: { width: target.width, height: target.height },
    deviceScaleFactor: 3,
  });
  for (const screen of screens) {
    let rawFile = path.join(rawDir, `${screen.raw}.png`);
    if (!(await exists(rawFile)) && screen.fallback) rawFile = path.join(here, screen.fallback);
    if (!(await exists(rawFile))) {
      console.warn('skipping', screen.raw, '(no capture)');
      continue;
    }
    const dataUrl = `data:image/png;base64,${(await readFile(rawFile)).toString('base64')}`;
    await page.setContent(html(target, screen, dataUrl, boxes[screen.raw] ?? screen.box), { waitUntil: 'networkidle' });
    // Match the status bar to the app's top edge, and shrink long headlines to fit.
    await page.evaluate(async () => {
      for (const line of document.querySelectorAll('.title > div')) {
        let size = parseFloat(getComputedStyle(line).fontSize);
        while (line.getBoundingClientRect().width > innerWidth - 36 && size > 12) line.style.fontSize = `${--size}px`;
      }
      const img = document.querySelector('.app');
      await img.decode();
      const c = document.createElement('canvas');
      c.width = 1;
      c.height = 1;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);
      const [r, gr, b] = g.getImageData(0, 0, 1, 1).data;
      document.querySelector('.screen').style.setProperty('--app-bg', `rgb(${r},${gr},${b})`);
    });
    await page.evaluate(() => document.fonts.ready);
    const file = path.join(dir, `${screen.out}.jpg`);
    await writeFile(file, await page.screenshot({ type: 'jpeg', quality: 92 }));
    console.log('wrote', file);
  }
  await page.close();
}

await browser.close();
