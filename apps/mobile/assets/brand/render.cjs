// Renders the app's icon set from emblem.svg. Run: node assets/brand/render.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const here = __dirname;
const out = path.join(here, '..');
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
