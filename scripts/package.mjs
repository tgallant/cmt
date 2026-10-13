import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { ZipWriter, Uint8ArrayWriter, Uint8ArrayReader } from '@zip.js/zip.js';

const zip = new ZipWriter(new Uint8ArrayWriter());
for (const name of ['manifest.json', 'background.js', 'content.js', 'ui.js', 'ui.css', 'manager.html', 'popup.html', 'overlay.html']) {
  await zip.add(name, new Uint8ArrayReader(await readFile(`dist/${name}`)));
}
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/cmt.zip', await zip.close());
console.log('Created artifacts/cmt.zip');
