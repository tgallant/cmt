import { build } from 'esbuild';
import { mkdir, rm, copyFile } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['src/background.js', 'src/content.js', 'src/ui.js'], outdir: 'dist', bundle: true, format: 'iife', target: 'firefox140', legalComments: 'none' });
for (const file of ['manifest.json', 'manager.html', 'popup.html', 'overlay.html', 'ui.css']) await copyFile(`src/${file}`, `dist/${file}`);
console.log('Built dist/');
