// Talks to the backend. Pass a body to POST it as JSON; leave it out to GET.
// On failure it throws an Error whose message is safe to show, with `field`
// naming the form field at fault, if any. If the admin session has ended, it
// goes back to the admin sign-in page.

export async function api(path, body) {
  const options = body === undefined
    ? { method: 'GET' }
    : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };

  let res;
  try {
    res = await fetch(path, { ...options, credentials: 'same-origin' });
  } catch {
    throw new Error('Could not reach the site. Check your connection and try again.');
  }

  if (res.status === 401) {
    window.location.href = '/admin';
    throw new Error('Your admin session has ended. Please sign in again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong. Please try again.'), { field: data.field });
  return data;
}
