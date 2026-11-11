// Assembles the site in web/ into dist/, which is what gets served.
//
//   web/pages/*.html         page shells; each "<!-- @include path -->" line is
//                            replaced by that file's contents
//   web/**/*.css             joined into one dist/styles.css, in the order below
//   web/**/*.js              copied as they are (the browser loads them as ES modules)
//   web/static/**            copied to the top of dist/ (photos, robots.txt)
//
// Run with `npm run build`. `npm run dev` runs it automatically on every change.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const DIST = path.join(ROOT, 'dist');

// Stylesheet order. Shared styles first, then each section in page order.
// motion.css stays last: it holds the reduced-motion overrides.
const STYLES = [
  'shared/base.css',
  'shared/layout.css',
  'shared/ui.css',
  'shared/forms.css',
  'shared/photo-frame.css',
  'components/nav/nav.css',
  'components/hero/hero.css',
  'components/announcement/announcement.css',
  'components/story/story.css',
  'components/celebration/celebration.css',
  'components/food/food.css',
  'components/rsvp/rsvp.css',
  'components/guestbook/guestbook.css',
  'components/good-to-know/good-to-know.css',
  'components/gifts/gifts.css',
  'components/closing/closing.css',
  'components/footer/footer.css',
  'admin/admin.css',
  'shared/hearts.css',
  'shared/motion.css',
];

const INCLUDE = /^([ \t]*)<!-- @include (\S+) -->[ \t]*$/gm;

/** Every file under a folder, as paths relative to it, with forward slashes. */
function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full, base) : [path.relative(base, full).split(path.sep).join('/')];
  });
}

function buildPage(file) {
  const source = fs.readFileSync(path.join(WEB, 'pages', file), 'utf8');
  return source.replace(INCLUDE, (line, indent, include) => {
    const target = path.join(WEB, include);
    if (!fs.existsSync(target)) throw new Error(`${file}: cannot find "${include}" to include`);
    return fs.readFileSync(target, 'utf8').trimEnd().split('\n')
      .map((text) => (text.trim() ? indent + text.replace(/\r$/, '') : ''))
      .join('\n');
  });
}

export function build() {
  const files = listFiles(WEB);

  const unlisted = files.filter((f) => f.endsWith('.css') && !STYLES.includes(f));
  if (unlisted.length) throw new Error(`Add these stylesheets to STYLES in scripts/build.js: ${unlisted.join(', ')}`);

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });

  for (const file of fs.readdirSync(path.join(WEB, 'pages'))) {
    fs.writeFileSync(path.join(DIST, file), buildPage(file));
  }

  const css = STYLES.map((file) => `/* ${file} */\n${fs.readFileSync(path.join(WEB, file), 'utf8').trim()}\n`);
  fs.writeFileSync(path.join(DIST, 'styles.css'), css.join('\n'));

  for (const file of files.filter((f) => f.endsWith('.js'))) {
    const target = path.join(DIST, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(WEB, file), target);
  }

  fs.cpSync(path.join(WEB, 'static'), DIST, { recursive: true });
}

// Run directly: `node scripts/build.js`
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  build();
  console.log(`Built ${listFiles(DIST).length} files into dist/`);
}
