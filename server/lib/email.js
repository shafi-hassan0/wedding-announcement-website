// Notification emails to Shafi and Phoenix, sent through EmailJS (the same service the
// portfolio site uses). The recipients are set on the EmailJS template.

import { config } from '../config.js';

/**
 * Sends a notification. If EmailJS is not configured the message is logged instead;
 * the admin page always has the full record either way.
 *
 * Never throws and is not awaited: a failed email must not fail the guest's request.
 */
export function notify(subject, message, { fromName = 'Celebration site', replyTo = '' } = {}) {
  const { serviceId, templateId, publicKey, privateKey } = config.emailjs;
  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.log(`[email not configured] ${subject}\n${message}`);
    return;
  }
  fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      accessToken: privateKey,
      template_params: { subject, message, from_name: fromName, reply_to: replyTo },
    }),
    signal: AbortSignal.timeout(15000),
  })
    .then(async (res) => {
      if (!res.ok) console.error('Email failed', res.status, await res.text());
    })
    .catch((err) => console.error('Email failed', err.message));
}
