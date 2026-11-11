// The admin page's data: RSVPs, guestbook moderation and contact messages.

import { config } from '../config.js';
import { all, run } from '../db.js';
import { HttpError, clientIp, json, readBody } from '../lib/http.js';
import { rateLimit } from '../lib/rate-limit.js';
import { clearCookie, requireAdmin, safeEqual, sessionCookie } from '../lib/session.js';

/** POST /api/admin/login */
export async function adminLogin(req) {
  const body = await readBody(req);
  rateLimit(`admin:${clientIp(req)}`, 10, 3600);
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
  const rsvps = all('SELECT id, name, contact_raw, attending, guests, dietary, note, updated_at FROM rsvps ORDER BY updated_at DESC');
  const notes = all('SELECT id, name, message, status, created_at FROM notes ORDER BY status DESC, created_at DESC');
  const contacts = all('SELECT id, name, reply_to, message, created_at FROM contacts ORDER BY created_at DESC');

  const coming = rsvps.filter((r) => r.attending);
  return json({
    totals: {
      responses: rsvps.length,
      households: coming.length,
      headcount: coming.reduce((sum, r) => sum + 1 + r.guests, 0),
      declined: rsvps.length - coming.length,
      pendingNotes: notes.filter((n) => n.status === 'pending').length,
    },
    rsvps,
    notes,
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
