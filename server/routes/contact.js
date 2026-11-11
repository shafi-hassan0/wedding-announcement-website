// The "Questions?" contact form. Open to anyone, so it is rate limited and has a honeypot.

import { run } from '../db.js';
import { notify } from '../lib/email.js';
import { HttpError, clientIp, json, readBody } from '../lib/http.js';
import { rateLimit } from '../lib/rate-limit.js';
import { text } from '../lib/validate.js';

/** POST /api/contact — saves the message and emails it to Shafi and Phoenix. */
export async function sendContactMessage(req) {
  const body = await readBody(req);
  if (body.website) return json({ ok: true }); // honeypot: only bots fill this in
  rateLimit(`contact:${clientIp(req)}`, 5, 3600);

  const name = text(body.name, 80);
  const replyTo = text(body.reply, 120);
  const message = text(body.message, 2000, true);
  if (name.length < 2) throw new HttpError(400, 'Please enter your name.', 'name');
  if (replyTo.length < 5) throw new HttpError(400, 'Please enter a phone number or email so they can reply.', 'reply');
  if (!message) throw new HttpError(400, 'Please write a message first.', 'message');

  run('INSERT INTO contacts (name, reply_to, message, created_at) VALUES (?, ?, ?, ?)',
    name, replyTo, message, new Date().toISOString());

  notify(`Question from ${name} (celebration site)`, `From: ${name}\nReply to: ${replyTo}\n\n${message}`,
    { fromName: name, replyTo: replyTo.includes('@') ? replyTo : '' });
  return json({ ok: true });
}
