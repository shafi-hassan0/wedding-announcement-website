// The admin page's data: RSVPs, guestbook moderation, updates and contact messages.

import { config } from '../config.js';
import { all, run } from '../db.js';
import { HttpError, clientIp, json, readBody } from '../lib/http.js';
import { rateLimit } from '../lib/rate-limit.js';
import { clearCookie, requireAdmin, safeEqual, sessionCookie } from '../lib/session.js';

/** POST /api/admin/login */
export async function adminLogin(req) {
  const body = await readBody(req);
  rateLimit(`admin:${clientIp(req)}`, 10, 3600);
  // A second cap across every address, so guessing spread over many machines is stopped too.
  rateLimit('admin:everyone', 60, 3600);
  if (!safeEqual(String(body.password || ''), config.adminPassword)) {
    throw new HttpError(401, 'That password is not right.', 'password');
  }
  return json({ ok: true }, 200, {
    'set-cookie': sessionCookie(req, config.adminCookie, 0, config.adminSessionSeconds, 'Strict'),
  });
}

/** POST /api/admin/logout */
export function adminLogout(req) {
  return clearCookie(req, config.adminCookie);
}

/** GET /api/admin/data — everything the admin page shows, with headcount totals. */
export function adminData(req) {
  requireAdmin(req);
  const rsvps = all(`SELECT id, name, contact_raw, attending, adults, children, babies, dietary, note, updated_at
    FROM rsvps ORDER BY updated_at DESC`);
  const notes = all('SELECT id, name, message, status, created_at FROM notes ORDER BY status DESC, created_at DESC');
  const contacts = all('SELECT id, name, reply_to, message, created_at FROM contacts ORDER BY created_at DESC');
  const posts = all('SELECT id, title, body, created_at, updated_at FROM posts ORDER BY created_at DESC');
  const comments = all(`SELECT c.id, c.name, c.message, c.status, c.created_at, p.title AS post_title
    FROM comments c JOIN posts p ON p.id = c.post_id ORDER BY c.status DESC, c.created_at DESC`);

  const coming = rsvps.filter((r) => r.attending);
  const sum = (key) => coming.reduce((total, r) => total + r[key], 0);
  const adults = sum('adults');
  const children = sum('children');
  const babies = sum('babies');
  return json({
    totals: {
      responses: rsvps.length,
      households: coming.length,
      headcount: adults + children + babies,
      adults,
      children,
      babies,
      declined: rsvps.length - coming.length,
      pendingNotes: notes.filter((n) => n.status === 'pending').length,
      pendingComments: comments.filter((c) => c.status === 'pending').length,
    },
    rsvps,
    notes,
    posts,
    comments,
    contacts,
  });
}

/**
 * POST /api/admin/rsvps/:id — delete an RSVP (a test entry, a duplicate, a mistake).
 * The guest's guestbook notes go with it, and their browser is no longer recognised.
 */
export async function deleteRsvp(req, id) {
  requireAdmin(req);
  const body = await readBody(req);
  if (body.action !== 'delete') throw new HttpError(400, 'Unknown action.');
  const result = run('DELETE FROM rsvps WHERE id = ?', id);
  if (result.changes === 0) throw new HttpError(404, 'That RSVP is already gone.');
  return json({ ok: true });
}

/** POST /api/admin/contacts/:id — delete a message that came in through the contact form. */
export async function deleteContactMessage(req, id) {
  requireAdmin(req);
  const body = await readBody(req);
  if (body.action !== 'delete') throw new HttpError(400, 'Unknown action.');
  const result = run('DELETE FROM contacts WHERE id = ?', id);
  if (result.changes === 0) throw new HttpError(404, 'That message is already gone.');
  return json({ ok: true });
}

/** POST /api/admin/notes/:id — approve a note, take it back off the site, or delete it. */
export async function moderateNote(req, id) {
  requireAdmin(req);
  const body = await readBody(req);
  if (body.action === 'approve') run("UPDATE notes SET status = 'approved' WHERE id = ?", id);
  else if (body.action === 'hide') run("UPDATE notes SET status = 'pending' WHERE id = ?", id);
  else if (body.action === 'delete') run('DELETE FROM notes WHERE id = ?', id);
  else throw new HttpError(400, 'Unknown action.');
  return json({ ok: true });
}
