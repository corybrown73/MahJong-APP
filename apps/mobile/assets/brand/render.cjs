// Renders the app's and the browser build's icons from emblem.svg.
// Run from apps/mobile: node assets/brand/render.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const here = __dirname;
const out = path.join(here, '..');
const pub = path.join(here, '..', '..', 'public');
fs.mkdirSync(path.join(pub, 'icons'), { recursive: true });
const emblem = fs.readFileSync(path.join(here, 'emblem.svg'), 'utf8');
const mono = emblem
  .replace(/url\(#\w+\)/g, '#FFFFFF')
  .replace(/stroke="#fff"[^/]*\/>/g, '/>')
  .replace(/#C23B22/g, '#000000');
const room = `radial-gradient(ellipse 90% 70% at 50% 0%, #6E2F1B 0%, #15100D 55%, #0C0907 100%)`;
const page = (body, bg) => `<!doctype html><html><body style="margin:0;width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;background:${bg}">${body}</body></html>`;
const jobs = [
  { file: 'icon.png', size: 1024, bg: room, svg: emblem, scale: 0.6 },
  { file: 'splash-icon.png', size: 1024, bg: 'transparent', svg: emblem, scale: 0.42 },
  { file: 'android-icon-foreground.png', size: 1024, bg: 'transparent', svg: emblem, scale: 0.46 },
  { file: 'android-icon-background.png', size: 1024, bg: room, svg: '', scale: 0 },
  { file: 'android-icon-monochrome.png', size: 1024, bg: 'transparent', svg: mono, scale: 0.46 },
  { file: 'favicon.png', size: 96, bg: room, svg: emblem, scale: 0.7 },
  // The browser build: the favicon, install icons, and the iOS home-screen icon.
  { file: '../public/favicon.png', size: 96, bg: room, svg: emblem, scale: 0.7 },
  { file: '../public/icons/icon-192.png', size: 192, bg: room, svg: emblem, scale: 0.62 },
  { file: '../public/icons/icon-512.png', size: 512, bg: room, svg: emblem, scale: 0.62 },
  // Maskable icons get cropped to a circle or squircle: keep the mark inside the safe zone.
  { file: '../public/icons/maskable-512.png', size: 512, bg: room, svg: emblem, scale: 0.5 },
  { file: '../public/icons/apple-touch-icon.png', size: 180, bg: room, svg: emblem, scale: 0.62 },
];
(async () => {
  const browser = await chromium.launch();
  for (const job of jobs) {
    const p = await browser.newPage({ viewport: { width: job.size, height: job.size } });
    const h = Math.round(job.size * job.scale);
    const svg = job.svg.replace('<svg ', `<svg height="${h}" `);
    await p.setContent(page(svg, job.bg));
    await p.screenshot({ path: path.join(out, job.file), omitBackground: job.bg === 'transparent' });
    await p.close();
    console.log('wrote', job.file);
  }
  await browser.close();
})();
