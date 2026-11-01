// Build the browser version into apps/mobile/dist, ready for any static host.
//
//   node scripts/build-web.mjs            served from a domain root
//   EXPO_BASE_URL=/MahJong-APP node ...   served under a sub-path (GitHub Pages)
//
// The app is a single page, so every route has to come back as index.html.
// Static hosts that cannot rewrite (GitHub Pages) serve 404.html for unknown
// paths instead, so the same page goes there too. .nojekyll stops Pages from
// dropping the _expo/ folder, which Jekyll treats as private.
import { spawnSync } from 'node:child_process';
import { copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');

const result = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist', '--clear'], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});
if (result.status !== 0) process.exit(result.status ?? 1);

if (!existsSync(join(out, 'index.html'))) {
  console.error('expo export produced no index.html');
  process.exit(1);
}
copyFileSync(join(out, 'index.html'), join(out, '404.html'));
writeFileSync(join(out, '.nojekyll'), '');
console.log(`\nBrowser build ready in ${out}${process.env.EXPO_BASE_URL ? ` (base ${process.env.EXPO_BASE_URL})` : ''}`);
