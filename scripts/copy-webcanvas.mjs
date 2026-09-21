import { copyFile, mkdir } from 'node:fs/promises';

// Resolve the installed ESM entry without depending on pnpm's store layout.
const source = new URL('./', import.meta.resolve('@thorvg/webcanvas'));
const destination = new URL('../dist/webcanvas/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const name of ['webcanvas.esm.js', 'webcanvas.esm.js.map', 'thorvg.wasm']) {
  await copyFile(new URL(name, source), new URL(name, destination));
}
await copyFile(new URL('../LICENSE', source), new URL('LICENSE', destination));
