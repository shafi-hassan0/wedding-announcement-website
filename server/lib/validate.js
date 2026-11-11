// Cleaning and checking what guests type in.

import { config } from '../config.js';
import { HttpError } from './http.js';

/** Trims, caps the length, and strips control characters. Multiline text keeps its line breaks. */
export function text(value, max, multiline = false) {
  let s = typeof value === 'string' ? value : '';
  s = multiline ? s.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '') : s.replace(/[\u0000-\u001F\u007F]/g, ' ');
  if (multiline) s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim().slice(0, max);
}

/**
 * Turns a phone number or email into the form RSVPs are looked up by, or null if it is neither.
 * Emails are lowercased; phone numbers are reduced to their digits, so "(804) 555-0101" and
 * "1-804-555-0101" match.
 */
export function normalizeContact(raw) {
  const s = raw.trim();
  if (s.includes('@')) {
    const email = s.toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  }
  let digits = s.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

/** Upper and lower case are treated the same. */
export function checkInviteCode(code) {
  if (String(code || '').trim().toLowerCase() !== config.inviteCode) {
    throw new HttpError(403, "Hmm, that code doesn't match. Check your invitation and try again.", 'code');
  }
}
