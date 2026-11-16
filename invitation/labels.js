// The envelope labels, in two sets that each print as their own PDF: a return address
// label for every invitation, and a delivery label for every guest with an address.
// Each set has its own choice of label sheets. Styles, including each label sheet's
// measurements, are in labels.css.

import { addressLines, hasAddress } from './address.js';
import { store } from './store.js';

// Label sheets on offer. The measurements for each are in labels.css.
export const LABEL_STOCK = {
  avery5160: { perSheet: 30 },
  avery5163: { perSheet: 10 },
};

// Label sheets are portrait letter paper.
export const LABEL_PAGE = '@page { size: 8.5in 11in; margin: 0; }';

// Where each set is previewed and printed from.
const containers = {
  return: document.getElementById('return-labels'),
  delivery: document.getElementById('delivery-labels'),
};

function line(className, text) {
  const p = document.createElement('p');
  if (className) p.className = className;
  p.textContent = text;
  return p;
}

function buildLabel(address, kind) {
  const label = document.createElement('div');
  label.className = `label is-${kind}`;
  if (address.name) label.append(line('label-name', address.name));
  for (const text of addressLines(address)) label.append(line('', text));
  return label;
}

/** As many sheets of the given label stock as the labels need. */
function sheetsOf(labels, stock) {
  const { perSheet } = LABEL_STOCK[stock];
  const sheets = [];
  for (let i = 0; i < labels.length; i += perSheet) {
    const sheet = document.createElement('div');
    sheet.className = `label-sheet ${stock}`;
    sheet.append(...labels.slice(i, i + perSheet));
    sheets.push(sheet);
  }
  return sheets;
}

function note(text, warning = false) {
  const p = document.createElement('p');
  p.className = warning ? 'preview-note is-warning' : 'preview-note';
  p.textContent = text;
  return p;
}

/** Redraws both sets of label sheets. Returns counts for the summaries under the PDF buttons. */
export function renderLabels() {
  const guests = store.invitees;
  const returnReady = hasAddress(store.returnAddress);
  const returnLabels = returnReady ? guests.map(() => buildLabel(store.returnAddress, 'return')) : [];
  const deliveryLabels = guests.filter(hasAddress).map((guest) => buildLabel(guest, 'delivery'));
  const missing = guests.filter((guest) => !hasAddress(guest)).map((guest) => guest.name);

  const returnNotes = [];
  const deliveryNotes = [];
  if (!guests.length) {
    returnNotes.push(note('No guests yet. Add guests to make their labels.'));
    deliveryNotes.push(note('No guests yet. Add guests to make their labels.'));
  }
  if (guests.length && !returnReady) returnNotes.push(note('Add a return address to make the return labels.', true));
  if (missing.length) {
    const who = missing.length === 1 ? '1 guest has' : `${missing.length} guests have`;
    deliveryNotes.push(note(`${who} no address yet, so no delivery label: ${missing.join(', ')}.`, true));
  }

  const returnSheets = sheetsOf(returnLabels, store.returnStock);
  const deliverySheets = sheetsOf(deliveryLabels, store.deliveryStock);
  containers.return.replaceChildren(...returnNotes, ...returnSheets);
  containers.delivery.replaceChildren(...deliveryNotes, ...deliverySheets);

  return {
    returnLabels: returnLabels.length,
    returnSheets: returnSheets.length,
    deliveryLabels: deliveryLabels.length,
    deliverySheets: deliverySheets.length,
    missing: missing.length,
  };
}

/** Is this preview tab one of the label sets? */
export const isLabelView = (view) => view in containers;

/**
 * Shrinks any label line too long for its label (a long name or street) until it fits.
 * Only works while the labels are on screen, so it runs when a label tab is shown and
 * just before printing. `view` is "return" or "delivery".
 */
export function fitLabels(view) {
  for (const p of containers[view].querySelectorAll('.label p')) {
    p.style.fontSize = '';
    let size = parseFloat(getComputedStyle(p).fontSize);
    const smallest = size * 0.6;
    while (p.scrollWidth > p.clientWidth + 0.5 && size > smallest) {
      size *= 0.95;
      p.style.fontSize = `${size}px`;
    }
  }
}
