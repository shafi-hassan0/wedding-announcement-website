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

// The only files that can be requested, and their types.
const FILES = {
  'invitation.css': 'text/css; charset=utf-8',
  'invitation.js': 'text/javascript; charset=utf-8',
  'qr.svg': 'image/svg+xml',
};

// Reads the page and its files. The page's links to its stylesheet and script get a
// fingerprint of their contents, so a browser never pairs a new page with an old cached file.
function readFiles() {
  const assets = Object.fromEntries(
    Object.keys(FILES).map((name) => [name, fs.readFileSync(path.join(config.invitationDir, name))])
  );
  const hash = crypto.createHash('sha256');
  for (const name of Object.keys(FILES)) hash.update(assets[name]);
  const version = hash.digest('hex').slice(0, 10);
  const page = fs.readFileSync(path.join(config.invitationDir, 'index.html'), 'utf8')
    .replace(/(\/admin\/invitations\/[\w.-]+\.(?:css|js|svg))"/g, `$1?v=${version}"`);
  return { assets, page };
}

// In production the files never change while the server runs, so read them once at start
// (which also stops the server from starting if one is missing). In development, read them
// on every request so an edit shows up on refresh.
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

  const name = url.pathname.slice(BASE.length).replace(/^\//, '');
  const send = (type, body) => {
    // "private, no-store": never kept by Cloudflare or the browser, since it is for admins only.
    res.writeHead(200, { ...PAGE_HEADERS, 'content-type': type, 'cache-control': 'private, no-store' })
      .end(req.method === 'HEAD' ? undefined : body);
  };

  const { assets, page } = files();
  if (name === '') return send('text/html; charset=utf-8', page);
  if (Object.hasOwn(FILES, name)) return send(FILES[name], assets[name]);
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
}

/** GET /api/admin/invite-code — the code to print on the invitations. */
export function inviteCode(req) {
  requireAdmin(req);
  return json({ code: config.inviteCodeAsWritten });
}
