// Local development: builds the site, rebuilds it whenever a file in web/ changes,
// and runs the backend (which also serves dist/). Start with `npm run dev`.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(SCRIPTS, '..', 'web');
const BUILD = path.join(SCRIPTS, 'build.js');

// Each build runs as its own process, so an edit to build.js itself
// (for example adding a stylesheet to its list) takes effect on the next change.
function rebuild() {
  const result = spawnSync(process.execPath, [BUILD], { encoding: 'utf8' });
  const time = new Date().toLocaleTimeString();
  if (result.status === 0) {
    console.log(`[build] ${time} site rebuilt`);
  } else {
    const reason = (result.stderr || '').split('\n').find((line) => line.startsWith('Error:')) || result.stderr;
    console.error(`[build] ${time} failed: ${reason}`);
  }
}

rebuild();

let timer;
const schedule = () => {
  clearTimeout(timer);
  timer = setTimeout(rebuild, 150);
};
fs.watch(WEB, { recursive: true }, schedule);
fs.watch(BUILD, schedule);

await import('../server/index.js');
