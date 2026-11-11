// Everything the page shows, in one place. Parts of the page subscribe with
// onStoreChange and redraw whenever storeChanged() is called.

export const store = {
  invitees: [], // [{ id, name, line1, line2, city, state, zip }], from the server
  returnAddress: { name: '', line1: '', line2: '', city: '', state: '', zip: '' },
  inviteCode: '',
  paper: 'letter', // a key of PAPER in cards.js
  labelStock: 'avery5160', // a key of LABEL_STOCK in labels.js
};

const listeners = [];

/** Calls `listener(store)` every time the store changes. */
export function onStoreChange(listener) {
  listeners.push(listener);
}

/** Tells every subscribed part of the page to redraw. */
export function storeChanged() {
  for (const listener of listeners) listener(store);
}
