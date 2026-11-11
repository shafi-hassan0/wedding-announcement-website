// Small helpers for reading requests and building JSON responses.

/** Throw this from a route to send an error message (and the form field it belongs to) to the guest. */
export class HttpError extends Error {
  constructor(status, message, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

/** A JSON response. Routes return this; the server writes it out. */
export function json(data, status = 200, headers = {}) {
  return {
    status,
    body: JSON.stringify(data),
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-robots-tag': 'noindex, nofollow',
      ...headers,
    },
  };
}

/** Reads and parses a JSON request body, refusing anything over 10 KB. */
export function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let tooLong = false;
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      if (tooLong) return;
      raw += chunk;
      if (raw.length > 10000) {
        tooLong = true;
        raw = '';
        reject(new HttpError(413, 'That is too long.'));
      }
    });
    req.on('error', () => reject(new HttpError(400, 'Request not understood.')));
    req.on('end', () => {
      if (tooLong) return;
      try {
        const body = JSON.parse(raw);
        if (body && typeof body === 'object') return resolve(body);
      } catch {}
      reject(new HttpError(400, 'Request not understood.'));
    });
  });
}

// The tunnel and nginx pass the visitor's details along in headers; nothing else can reach this server.

export function clientIp(req) {
  return req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';
}

export function isHttps(req) {
  return String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}

/** The site's public address, for links in notification emails. */
export function siteOrigin(req) {
  return `${isHttps(req) ? 'https' : 'http'}://${req.headers.host}`;
}

/** Blocks cross-site form posts: POSTs must come from this site and be JSON. */
export function checkSameSite(req) {
  const origin = req.headers.origin;
  if (origin) {
    let originHost = '';
    try {
      originHost = new URL(origin).host;
    } catch {}
    if (originHost !== req.headers.host) throw new HttpError(403, 'Request not allowed.');
  }
  if (!(req.headers['content-type'] || '').includes('application/json')) {
    throw new HttpError(415, 'Request not allowed.');
  }
}
