// Talks to the backend. Pass a body to POST it as JSON; leave it out to GET.
// On failure it throws an Error whose message is safe to show the guest, with
// `status` (the HTTP status, 0 if offline) and `field` (the form field at fault, if any).

export async function api(path, body) {
  const options = body === undefined
    ? { method: 'GET' }
    : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };

  let res;
  try {
    res = await fetch(path, { ...options, credentials: 'same-origin' });
  } catch {
    throw Object.assign(new Error('Could not reach the site. Check your connection and try again.'), { status: 0 });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data.error || 'Something went wrong. Please try again.'), {
      status: res.status,
      field: data.field,
    });
  }
  return data;
}
