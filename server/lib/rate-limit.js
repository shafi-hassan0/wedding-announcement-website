// Limits how often one visitor can try something (guessing the invite code, sending messages).

import { get } from '../db.js';
import { HttpError } from './http.js';

/** Allows `max` calls per `windowSeconds` for a key such as "rsvp:<ip address>"; throws after that. */
export function rateLimit(key, max, windowSeconds) {
  const win = Math.floor(Date.now() / 1000 / windowSeconds);
  const row = get(
    `INSERT INTO attempts (key, win, count) VALUES (?, ?, 1)
     ON CONFLICT(key, win) DO UPDATE SET count = count + 1 RETURNING count`,
    key, win
  );
  if (row.count > max) throw new HttpError(429, 'Too many tries. Please wait a little while and try again.');
}
