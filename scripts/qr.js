// Makes a QR code as an SVG file, with no dependencies. Used for the photo album
// codes on the site and on the backs of the invitations (web/static/qr/).
//
//   node scripts/qr.js <link> <output.svg> "<description for screen readers>"
//
// Byte mode, versions 1 to 10 (up to about 200 characters), error correction
// level M or better. Follows ISO/IEC 18004; the structure follows Project Nayuki's
// reference QR Code generator.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Error correction levels: [formatBits, codewords per block by version, blocks by version].
// Index 0 of each table is unused so that tables are indexed by version number.
const ECC = {
  L: [1, [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18], [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4]],
  M: [0, [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26], [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]],
  Q: [3, [0, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24], [0, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8]],
  H: [2, [0, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28], [0, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8]],
};
const LEVELS = ['L', 'M', 'Q', 'H'];
const MAX_VERSION = 10;

const bit = (value, i) => ((value >>> i) & 1) !== 0;

/** Modules available for data and error correction in a version. */
function rawDataModules(ver) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2;
    result -= (25 * align - 10) * align - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

const dataCodewords = (ver, level) =>
  Math.floor(rawDataModules(ver) / 8) - ECC[level][1][ver] * ECC[level][2][ver];

/* ---------- Reed-Solomon error correction over GF(256) ---------- */

function gfMultiply(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree) {
  const result = new Array(degree - 1).fill(0).concat(1);
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data, divisor) {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    divisor.forEach((coef, i) => { result[i] ^= gfMultiply(coef, factor); });
  }
  return result;
}

/* ---------- the symbol ---------- */

/**
 * Encodes text into a QR code. Returns { size, modules } where modules[y][x] is
 * true for a dark module. `mask` (0-7) forces a mask pattern; normally the one with
 * the lowest penalty is chosen. `boost: false` keeps exactly the level asked for.
 */
export function encode(text, { level = 'M', mask, boost = true } = {}) {
  const bytes = [...new TextEncoder().encode(text)];

  // Smallest version that fits, then the strongest error correction that still fits it.
  let ver = 1;
  const fits = (v, l) => 4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= dataCodewords(v, l) * 8;
  while (!fits(ver, level)) {
    if (++ver > MAX_VERSION) throw new Error(`Too long for a version ${MAX_VERSION} QR code: ${text.length} characters.`);
  }
  if (boost) for (const stronger of LEVELS.slice(LEVELS.indexOf(level) + 1)) if (fits(ver, stronger)) level = stronger;

  // Data bits: byte mode, length, the bytes, then terminator and padding.
  const bits = [];
  const push = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, ver < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  const capacity = dataCodewords(ver, level) * 8;
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));

  // Split into blocks, add error correction to each, and interleave.
  const numBlocks = ECC[level][2][ver];
  const eccLen = ECC[level][1][ver];
  const rawCodewords = Math.floor(rawDataModules(ver) / 8);
  const numShort = numBlocks - (rawCodewords % numBlocks);
  const shortLen = Math.floor(rawCodewords / numBlocks);
  const divisor = rsDivisor(eccLen);
  const blocks = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const block = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
    k += block.length;
    const ecc = rsRemainder(block, divisor);
    if (i < numShort) block.push(0);
    blocks.push(block.concat(ecc));
  }
  const codewords = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= numShort) codewords.push(block[i]);
    });
  }

  // Draw the fixed patterns, then the data, then pick a mask.
  const size = ver * 4 + 17;
  const modules = Array.from({ length: size }, () => new Array(size).fill(false));
  const fixed = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, dark) => { modules[y][x] = dark; fixed[y][x] = true; };

  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); } // timing

  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) { // finders and separators
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx; const y = cy + dy;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
      }
    }
  }

  const align = [];
  if (ver > 1) { // alignment patterns
    const count = Math.floor(ver / 7) + 2;
    const step = Math.ceil((ver * 4 + 4) / (count * 2 - 2)) * 2;
    align.push(6);
    for (let pos = size - 7; align.length < count; pos -= step) align.splice(1, 0, pos);
  }
  const last = align.length - 1;
  align.forEach((ay, i) => align.forEach((ax, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }));

  const drawFormat = (m) => {
    const value = (ECC[level][0] << 3) | m;
    let rem = value;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const f = ((value << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) set(8, i, bit(f, i));
    set(8, 7, bit(f, 6));
    set(8, 8, bit(f, 7));
    set(7, 8, bit(f, 8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(f, i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(f, i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(f, i));
    set(8, size - 8, true); // the dark module
  };
  drawFormat(0); // reserves the format areas; redrawn with the real mask below

  if (ver >= 7) { // version information
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const v = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3); const b = Math.floor(i / 3);
      set(a, b, bit(v, i));
      set(b, a, bit(v, i));
    }
  }

  let i = 0; // data, in the zigzag order
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
        if (!fixed[y][x] && i < codewords.length * 8) {
          modules[y][x] = bit(codewords[i >>> 3], 7 - (i & 7));
          i++;
        }
      }
    }
  }

  const MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const applyMask = (m) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) if (!fixed[y][x] && MASKS[m](x, y)) modules[y][x] = !modules[y][x];
    }
  };

  let chosen = mask;
  if (chosen === undefined) {
    let best = Infinity;
    for (let m = 0; m < 8; m++) {
      applyMask(m);
      drawFormat(m);
      const score = penalty(modules, size);
      if (score < best) { best = score; chosen = m; }
      applyMask(m); // XOR again to undo
    }
  }
  applyMask(chosen);
  drawFormat(chosen);
  return { size, modules, version: ver, level, mask: chosen };
}

/** How hard a symbol is to read (lower is better), per the standard's four rules. */
function penalty(modules, size) {
  let score = 0;
  const line = (get) => {
    let runColor = false; let run = 0; const history = [0, 0, 0, 0, 0, 0, 0];
    const addHistory = (length) => {
      if (history[0] === 0) length += size; // the light border before the first run
      history.pop();
      history.unshift(length);
    };
    const finderLike = () => {
      const n = history[1];
      const core = n > 0 && history[2] === n && history[3] === n * 3 && history[4] === n && history[5] === n;
      return (core && history[0] >= n * 4 && history[6] >= n ? 1 : 0)
        + (core && history[6] >= n * 4 && history[0] >= n ? 1 : 0);
    };
    for (let i = 0; i < size; i++) {
      if (get(i) === runColor) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score++;
      } else {
        addHistory(run);
        if (!runColor) score += finderLike() * 40;
        runColor = get(i);
        run = 1;
      }
    }
    if (runColor) { addHistory(run); run = 0; }
    addHistory(run + size);
    score += finderLike() * 40;
  };
  for (let y = 0; y < size; y++) line((x) => modules[y][x]);
  for (let x = 0; x < size; x++) line((y) => modules[y][x]);

  let dark = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y][x]) dark++;
      if (x < size - 1 && y < size - 1) {
        const c = modules[y][x];
        if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3;
      }
    }
  }
  const total = size * size;
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return score;
}

/** The symbol as an SVG: dark rose modules on white, with the standard 4-module quiet zone. */
export function toSvg({ size, modules }, label, color = '#7d3345') {
  const full = size + 8;
  const runs = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!modules[y][x]) continue;
      let w = 1;
      while (x + w < size && modules[y][x + w]) w++;
      runs.push(`M${x} ${y}h${w}v1h-${w}z`);
      x += w - 1;
    }
  }
  const escaped = label.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 ${full} ${full}" shape-rendering="crispEdges" role="img" aria-label="${escaped}">
  <rect x="-4" y="-4" width="${full}" height="${full}" fill="#ffffff"/>
  <path fill="${color}" d="${runs.join('')}"/>
</svg>
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [text, output, label] = process.argv.slice(2);
  if (!text || !output) {
    console.error('Usage: node scripts/qr.js <link> <output.svg> "<description for screen readers>"');
    process.exit(1);
  }
  const symbol = encode(text);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, toSvg(symbol, label || `QR code for ${text}`));
  console.log(`${output}: version ${symbol.version}, level ${symbol.level}, mask ${symbol.mask}, ${symbol.size}×${symbol.size}`);
}
