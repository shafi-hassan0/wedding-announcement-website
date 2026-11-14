// Small helpers shared by the admin page's scripts.

export const $ = (id) => document.getElementById(id);

/** Builds an element; all text goes in as text, never as HTML. */
export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** A date and time, as shown in the admin tables. */
export function when(iso) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
