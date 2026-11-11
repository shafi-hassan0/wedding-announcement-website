// Settings and constants. Everything configurable comes from environment variables
// (see .env.example); the server refuses to start if a required one is missing.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const env = process.env;

for (const name of ['INVITE_CODE', 'ADMIN_PASSWORD', 'SESSION_SECRET']) {
  if (!env[name]) {
    console.error(`Missing required setting ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}
if (env.SESSION_SECRET.length < 16) {
  console.error('SESSION_SECRET must be at least 16 characters.');
  process.exit(1);
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const config = {
  port: Number(env.PORT) || 3000,
  // The built site. Only used when this server serves the pages itself (local development).
  staticDir: path.join(ROOT, 'dist'),
  dbPath: env.DB_PATH || path.join(ROOT, 'data', 'wedding.db'),

  inviteCode: env.INVITE_CODE.trim().toLowerCase(),
  adminPassword: env.ADMIN_PASSWORD,
  sessionSecret: env.SESSION_SECRET,

  emailjs: {
    serviceId: env.EMAILJS_SERVICE_ID || '',
    templateId: env.EMAILJS_TEMPLATE_ID || '',
    publicKey: env.EMAILJS_PUBLIC_KEY || '',
    privateKey: env.EMAILJS_PRIVATE_KEY || '',
  },

  guestCookie: 'guest',
  adminCookie: 'admin',
  guestSessionSeconds: 60 * 60 * 24 * 400, // about 13 months
  adminSessionSeconds: 60 * 60 * 12,
  maxNotesPerGuest: 5,
};
