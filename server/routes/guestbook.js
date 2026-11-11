// The guestbook. Only guests with an RSVP can read or write it, and a note stays
// hidden until Shafi or Phoenix approves it on the admin page.

import { config } from '../config.js';
import { all, get, run } from '../db.js';
import { notify } from '../lib/email.js';
import { HttpError, json, readBody, siteOrigin } from '../lib/http.js';
import { currentGuest } from '../lib/session.js';
import { text } from '../lib/validate.js';

/** GET /api/guestbook — approved notes, plus how many of this guest's own notes are still waiting. */
export function listNotes(req) {
  const guest = currentGuest(req);
  if (!guest) throw new HttpError(401, 'The guestbook opens once you have RSVP’d.');

  const notes = all("SELECT id, name, message, created_at FROM notes WHERE status = 'approved' ORDER BY created_at DESC LIMIT 300");
  const mine = get("SELECT COUNT(*) AS n FROM notes WHERE rsvp_id = ? AND status = 'pending'", guest.id);
  return json({ notes, pending: mine.n });
}

/** POST /api/guestbook — leaves a note, held for approval. */
export async function addNote(req) {
  const guest = currentGuest(req);
  if (!guest) throw new HttpError(401, 'Please RSVP first, then come back to sign the guestbook.');

  const body = await readBody(req);
  const message = text(body.message, 500, true);
  if (!message) throw new HttpError(400, 'Please write a message first.', 'message');
  if (String(body.message || '').trim().length > 500) {
    throw new HttpError(400, 'Please keep your note under 500 characters.', 'message');
  }

  const count = get('SELECT COUNT(*) AS n FROM notes WHERE rsvp_id = ?', guest.id);
  if (count.n >= config.maxNotesPerGuest) {
    throw new HttpError(429, `You have already left ${config.maxNotesPerGuest} notes. Thank you for all the love!`, 'message');
  }

  run("INSERT INTO notes (rsvp_id, name, message, status, created_at) VALUES (?, ?, ?, 'pending', ?)",
    guest.id, guest.name, message, new Date().toISOString());

  notify(`New guestbook note from ${guest.name} (needs approval)`,
    `${guest.name} wrote:\n\n${message}\n\nIt will not appear on the site until one of you approves it:\n${siteOrigin(req)}/admin`,
    { fromName: guest.name });
  return json({ ok: true });
}
