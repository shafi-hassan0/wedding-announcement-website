// The invitation maker at /admin/invitations. Unlike the rest of the site's pages,
// which nginx serves to anyone, these files are served from here so that only a
// signed-in admin can load them. Everyone else is sent to the admin sign-in page.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { json } from '../lib/http.js';
import { requireAdmin } from '../lib/session.js';
import { PAGE_HEADERS } from '../lib/static.js';

const BASE = '/admin/invitations';

const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/**
 * Reads the page and every stylesheet, script and image beside it.
 *
 * The page's links are pointed at a folder named after a fingerprint of those files
 * (/admin/invitations/v/<fingerprint>/...). The scripts import each other by relative
 * path, so they all load from the same folder, and a browser can never pair a new
 * page with an older cached script.
 */
function readFiles() {
  const assets = {};
  const hash = crypto.createHash('sha256');
  for (const name of fs.readdirSync(config.invitationDir).sort()) {
    if (!/^[\w-]+\.(css|js|svg)$/.test(name)) continue;
    assets[name] = fs.readFileSync(path.join(config.invitationDir, name));
    hash.update(name).update(assets[name]);
  }
  const version = hash.digest('hex').slice(0, 10);
  const page = fs.readFileSync(path.join(config.invitationDir, 'index.html'), 'utf8')
    .replace(/((?:href|src)=")\/admin\/invitations\/([\w-]+\.(?:css|js|svg)")/g, `$1${BASE}/v/${version}/$2`);
  return { assets, page };
}

// In production the files never change while the server runs, so read them once at start
// (which also stops the server from starting if the folder is missing). In development,
// read them on every request so an edit shows up on refresh.
const cached = readFiles();
const files = () => (process.env.NODE_ENV === 'production' ? cached : readFiles());

/** Is this address part of the invitation maker? */
export function isInvitationPath(pathname) {
  return pathname === BASE || pathname.startsWith(`${BASE}/`);
}

/** GET /admin/invitations and the files it loads. */
export function serveInvitations(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }
  try {
    requireAdmin(req);
  } catch {
    res.writeHead(302, { location: '/admin', 'cache-control': 'no-store' }).end();
    return;
  }

  const send = (type, body) => {
    // "private, no-store": never kept by Cloudflare or the browser, since it is for admins only.
    res.writeHead(200, { ...PAGE_HEADERS, 'content-type': type, 'cache-control': 'private, no-store' })
      .end(req.method === 'HEAD' ? undefined : body);
  };

  // "" for the page itself, otherwise a file name, with or without the "v/<fingerprint>/" folder.
  const name = url.pathname.slice(BASE.length).replace(/^\//, '').replace(/^v\/[0-9a-f]+\//, '');
  const { assets, page } = files();

  if (name === '') return send('text/html; charset=utf-8', page);
  if (Object.hasOwn(assets, name)) return send(TYPES[path.extname(name)], assets[name]);
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
}

/** GET /api/admin/invite-code — the code to print on the invitations. */
export function inviteCode(req) {
  requireAdmin(req);
  return json({ code: config.inviteCodeAsWritten });
}
