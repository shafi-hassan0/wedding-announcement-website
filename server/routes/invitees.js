// The invitation mailing list: who gets an invitation, their mailing address, and
// the return address for the envelopes. Used by the invitation maker at /admin/invitations.
//
// This is people's home addresses, so every route here requires an admin session and
// nothing on the public site can read it.

import { all, get, run } from '../db.js';
import { HttpError, json, readBody } from '../lib/http.js';
import { requireAdmin } from '../lib/session.js';
import { text } from '../lib/validate.js';

const RETURN_ADDRESS_KEY = 'return_address';
const EMPTY_ADDRESS = { name: '', line1: '', line2: '', city: '', state: '', zip: '' };
const COLUMNS = 'id, name, line1, line2, city, state, zip';

/** Cleans a name-and-address submitted from a form. */
function readAddress(body) {
  return {
    name: text(body.name, 80),
    line1: text(body.line1, 100),
    line2: text(body.line2, 60),
    city: text(body.city, 60),
    state: text(body.state, 30),
    zip: text(body.zip, 12),
  };
}

function readReturnAddress() {
  const row = get('SELECT value FROM settings WHERE key = ?', RETURN_ADDRESS_KEY);
  if (!row) return EMPTY_ADDRESS;
  try {
    return { ...EMPTY_ADDRESS, ...JSON.parse(row.value) };
  } catch {
    return EMPTY_ADDRESS;
  }
}

/** GET /api/admin/invitees — the whole list, plus the return address. */
export function listInvitees(req) {
  requireAdmin(req);
  return json({
    invitees: all(`SELECT ${COLUMNS} FROM invitees ORDER BY id`),
    returnAddress: readReturnAddress(),
  });
}

/** POST /api/admin/invitees — add someone. Only the name is required; an address can come later. */
export async function addInvitee(req) {
  requireAdmin(req);
  const a = readAddress(await readBody(req));
  if (!a.name) throw new HttpError(400, 'Please enter a name.', 'name');

  const now = new Date().toISOString();
  const invitee = get(
    `INSERT INTO invitees (name, line1, line2, city, state, zip, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7) RETURNING ${COLUMNS}`,
    a.name, a.line1, a.line2, a.city, a.state, a.zip, now
  );
  return json({ invitee });
}

/** POST /api/admin/invitees/:id — { action: "update", ...address } or { action: "delete" }. */
export async function changeInvitee(req, id) {
  requireAdmin(req);
  const body = await readBody(req);

  if (body.action === 'delete') {
    const result = run('DELETE FROM invitees WHERE id = ?', id);
    if (result.changes === 0) throw new HttpError(404, 'That guest is already gone.');
    return json({ ok: true });
  }

  if (body.action === 'update') {
    const a = readAddress(body);
    if (!a.name) throw new HttpError(400, 'Please enter a name.', 'name');
    const invitee = get(
      `UPDATE invitees SET name = ?1, line1 = ?2, line2 = ?3, city = ?4, state = ?5, zip = ?6, updated_at = ?7
       WHERE id = ?8 RETURNING ${COLUMNS}`,
      a.name, a.line1, a.line2, a.city, a.state, a.zip, new Date().toISOString(), id
    );
    if (!invitee) throw new HttpError(404, 'That guest no longer exists.');
    return json({ invitee });
  }

  throw new HttpError(400, 'Unknown action.');
}

/** POST /api/admin/return-address — the address printed on the return labels. */
export async function saveReturnAddress(req) {
  requireAdmin(req);
  const returnAddress = readAddress(await readBody(req));
  run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    RETURN_ADDRESS_KEY, JSON.stringify(returnAddress)
  );
  return json({ returnAddress });
}
