// RSVPs, and recognising a guest who has already sent one.

import { config } from '../config.js';
import { get } from '../db.js';
import { notify } from '../lib/email.js';
import { HttpError, clientIp, json, readBody, siteOrigin } from '../lib/http.js';
import { rateLimit } from '../lib/rate-limit.js';
import { clearCookie, currentGuest, publicGuest, sessionCookie } from '../lib/session.js';
import { checkInviteCode, normalizeContact, text } from '../lib/validate.js';

/** GET /api/me — who the browser's cookie says this is, if anyone. */
export function me(req) {
  const guest = currentGuest(req);
  return json({ guest: guest ? publicGuest(guest) : null });
}

/**
 * POST /api/rsvp — saves an RSVP and remembers the guest on this device.
 * Sending it again with the same phone or email updates that RSVP.
 */
export async function submitRsvp(req) {
  const body = await readBody(req);
  if (body.website) return json({ ok: true, guest: null }); // honeypot: only bots fill this in
  rateLimit(`rsvp:${clientIp(req)}`, 20, 3600);
  checkInviteCode(body.code);

  const name = text(body.name, 80);
  if (name.length < 2) throw new HttpError(400, 'Please enter your full name.', 'name');

  const contactRaw = text(body.contact, 120);
  const contactKey = normalizeContact(contactRaw);
  if (!contactKey) throw new HttpError(400, 'Please enter a valid phone number or email.', 'contact');

  if (body.attending !== true && body.attending !== false) {
    throw new HttpError(400, 'Please let them know if you can make it.', 'attending');
  }
  const attending = body.attending ? 1 : 0;

  let guests = Number.parseInt(body.guests, 10);
  if (!Number.isFinite(guests) || guests < 0) guests = 0;
  if (guests > 20) throw new HttpError(400, 'That is a big group! Please contact Shafi or Phoenix directly.', 'guests');
  if (!attending) guests = 0;

  const dietary = text(body.dietary, 300);
  const note = text(body.note, 500);
  const now = new Date().toISOString();

  const row = get(
    `INSERT INTO rsvps (name, contact, contact_raw, attending, guests, dietary, note, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)
     ON CONFLICT(contact) DO UPDATE SET
       name = excluded.name, contact_raw = excluded.contact_raw, attending = excluded.attending,
       guests = excluded.guests, dietary = excluded.dietary, note = excluded.note, updated_at = excluded.updated_at
     RETURNING id, name, attending, created_at, updated_at`,
    name, contactKey, contactRaw, attending, guests, dietary, note, now
  );

  const isUpdate = row.created_at !== row.updated_at;
  const summary = attending ? `coming (${1 + guests} total)` : 'cannot make it';
  const lines = [
    `Name: ${name}`,
    `Contact: ${contactRaw}`,
    `Attending: ${attending ? 'Yes' : 'No'}`,
    attending ? `Coming with them: ${guests} (total ${1 + guests})` : null,
    dietary ? `Dietary needs: ${dietary}` : null,
    note ? `Note: ${note}` : null,
    '',
    `All RSVPs: ${siteOrigin(req)}/admin`,
  ];
  notify(`${isUpdate ? 'Updated RSVP' : 'New RSVP'}: ${name} - ${summary}`,
    lines.filter((line) => line !== null).join('\n'),
    { fromName: name, replyTo: contactRaw.includes('@') ? contactRaw : '' });

  return json({ ok: true, guest: publicGuest(row) }, 200, {
    'set-cookie': sessionCookie(req, config.guestCookie, row.id, config.guestSessionSeconds),
  });
}

/** POST /api/signin — a returning guest on a new device: invite code plus the phone or email they RSVP'd with. */
export async function signIn(req) {
  const body = await readBody(req);
  rateLimit(`signin:${clientIp(req)}`, 10, 3600);
  checkInviteCode(body.code);

  const contactKey = normalizeContact(text(body.contact, 120));
  const row = contactKey ? get('SELECT id, name, attending FROM rsvps WHERE contact = ?', contactKey) : null;
  if (!row) {
    throw new HttpError(404, "We couldn't find an RSVP with those details. Double-check them, or reach out to Shafi or Phoenix for help.", 'contact');
  }
  return json({ ok: true, guest: publicGuest(row) }, 200, {
    'set-cookie': sessionCookie(req, config.guestCookie, row.id, config.guestSessionSeconds),
  });
}

/** POST /api/signout — forgets the guest on this device. */
export function signOut(req) {
  return clearCookie(req, config.guestCookie);
}
