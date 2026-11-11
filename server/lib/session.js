// Signed cookies that remember a guest after they RSVP, and an admin after they sign in.
// The cookie holds an id and an expiry, signed with SESSION_SECRET so it cannot be forged.

import crypto from 'node:crypto';
import { config } from '../config.js';
import { get } from '../db.js';
import { HttpError, isHttps, json } from './http.js';

function sign(data) {
  return crypto.createHmac('sha256', config.sessionSecret).update(data).digest('base64url');
}

/** Compares two strings without leaking, through timing, how much of them matched. */
export function safeEqual(a, b) {
  const x = crypto.createHash('sha256').update(a).digest();
  const y = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(x, y);
}

/** The Set-Cookie header value for a new session. */
export function sessionCookie(req, name, id, ttlSeconds, sameSite = 'Lax') {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const value = `${id}.${exp}.${sign(`${name}.${id}.${exp}`)}`;
  return `${name}=${value}; Path=/; Max-Age=${ttlSeconds}; HttpOnly; SameSite=${sameSite}${isHttps(req) ? '; Secure' : ''}`;
}

/** A response that removes the named cookie. */
export function clearCookie(req, name) {
  return json({ ok: true }, 200, {
    'set-cookie': `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${isHttps(req) ? '; Secure' : ''}`,
  });
}

/** The id stored in a valid, unexpired session cookie, or null. */
function readSession(req, name) {
  const header = req.headers.cookie || '';
  const match = header.split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  if (!match) return null;
  const [id, exp, sig] = match.slice(name.length + 1).split('.');
  if (!id || !exp || !sig || Number(exp) < Date.now() / 1000) return null;
  return safeEqual(sig, sign(`${name}.${id}.${exp}`)) ? Number(id) : null;
}

/** The RSVP row of the guest making this request, or null if they are not recognised. */
export function currentGuest(req) {
  const id = readSession(req, config.guestCookie);
  if (id === null) return null;
  return get('SELECT id, name, attending FROM rsvps WHERE id = ?', id) || null;
}

/** Throws unless the request carries a valid admin session. */
export function requireAdmin(req) {
  if (readSession(req, config.adminCookie) === null) throw new HttpError(401, 'Please sign in.');
}

/** What the browser is allowed to know about a guest. */
export function publicGuest(row) {
  return { name: row.name, firstName: row.name.split(/\s+/)[0], attending: !!row.attending };
}
