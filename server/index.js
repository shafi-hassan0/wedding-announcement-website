// Backend entry point: RSVPs, guestbook, contact form and admin.
//
// A plain Node server with no npm dependencies. In production nginx serves the
// built site and proxies /api/ here; run directly (npm run dev), this server
// serves the built site from dist/ itself.

import http from 'node:http';
import { config } from './config.js';
import { closeDb } from './db.js';
import { HttpError, checkSameSite, json } from './lib/http.js';
import { serveStatic } from './lib/static.js';
import { adminData, adminLogin, adminLogout, moderateNote } from './routes/admin.js';
import { sendContactMessage } from './routes/contact.js';
import { addNote, listNotes } from './routes/guestbook.js';
import { me, signIn, signOut, submitRsvp } from './routes/rsvp.js';

// Every API endpoint, in one place.
const routes = {
  'GET /api/health': () => json({ ok: true }),

  'GET /api/me': me,
  'POST /api/rsvp': submitRsvp,
  'POST /api/signin': signIn,
  'POST /api/signout': signOut,

  'GET /api/guestbook': listNotes,
  'POST /api/guestbook': addNote,

  'POST /api/contact': sendContactMessage,

  'POST /api/admin/login': adminLogin,
  'POST /api/admin/logout': adminLogout,
  'GET /api/admin/data': adminData,
};

async function handleApi(req, url) {
  if (req.method === 'POST') checkSameSite(req);

  const handler = routes[`${req.method} ${url.pathname}`];
  if (handler) return handler(req);

  // The one route with an id in its path.
  const note = url.pathname.match(/^\/api\/admin\/notes\/(\d+)$/);
  if (note && req.method === 'POST') return moderateNote(req, Number(note[1]));

  throw new HttpError(404, 'Not found.');
}

const server = http.createServer(async (req, res) => {
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url);

  let result;
  try {
    result = await handleApi(req, url);
  } catch (err) {
    if (err instanceof HttpError) {
      result = json({ error: err.message, field: err.field }, err.status);
    } else {
      console.error(err);
      result = json({ error: 'Something went wrong. Please try again.' }, 500);
    }
  }
  res.writeHead(result.status, result.headers).end(result.body);
});

server.listen(config.port, () => {
  console.log(`Celebration site backend listening on port ${config.port} (database: ${config.dbPath})`);
});

// Finish in-flight requests and close the database cleanly when Docker stops the container.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => {
      closeDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
