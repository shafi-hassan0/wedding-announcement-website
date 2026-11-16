// Everything the page shows, in one place. Parts of the page subscribe with
// onStoreChange and redraw whenever storeChanged() is called.

export const store = {
  invitees: [], // [{ id, name, line1, line2, city, state, zip, country }], from the server
  returnAddress: { name: '', line1: '', line2: '', city: '', state: '', zip: '', country: '' },
  inviteCode: '',
  paper: 'letter', // a key of PAPER in cards.js
  backs: true, // print the photo album QR codes on the back of every invitation
  returnStock: 'avery5160', // label sheets for the return labels: a key of LABEL_STOCK in labels.js
  deliveryStock: 'avery5163', // label sheets for the delivery labels: a key of LABEL_STOCK in labels.js
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
