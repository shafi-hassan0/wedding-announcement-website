// The envelope labels: a return address label for every invitation, and a delivery
// label for every guest with an address. Each kind starts on its own sheet.
// Styles, including each label sheet's measurements, are in labels.css.

import { addressLines, hasAddress } from './address.js';
import { store } from './store.js';

// Label sheets on offer. The measurements for each are in labels.css.
export const LABEL_STOCK = {
  avery5160: { perSheet: 30 },
  avery5163: { perSheet: 10 },
};

// Label sheets are portrait letter paper.
export const LABEL_PAGE = '@page { size: 8.5in 11in; margin: 0; }';

const container = document.getElementById('labels');

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

/** A heading (screen only) followed by as many sheets as the labels need. */
function sheetsOf(title, labels, perSheet) {
  if (!labels.length) return [];
  const heading = document.createElement('h2');
  heading.className = 'sheet-title';
  heading.textContent = title;

  const sheets = [];
  for (let i = 0; i < labels.length; i += perSheet) {
    const sheet = document.createElement('div');
    sheet.className = 'label-sheet';
    sheet.append(...labels.slice(i, i + perSheet));
    sheets.push(sheet);
  }
  return [heading, ...sheets];
}

function note(text, warning = false) {
  const p = document.createElement('p');
  p.className = warning ? 'preview-note is-warning' : 'preview-note';
  p.textContent = text;
  return p;
}

/** Redraws the label sheets. Returns counts for the summary under the PDF button. */
export function renderLabels() {
  const { perSheet } = LABEL_STOCK[store.labelStock];
  container.classList.remove(...Object.keys(LABEL_STOCK));
  container.classList.add(store.labelStock);

  const guests = store.invitees;
  const returnReady = hasAddress(store.returnAddress);
  const returnLabels = returnReady ? guests.map(() => buildLabel(store.returnAddress, 'return')) : [];
  const withAddress = guests.filter(hasAddress);
  const deliveryLabels = withAddress.map((guest) => buildLabel(guest, 'delivery'));
  const missing = guests.filter((guest) => !hasAddress(guest)).map((guest) => guest.name);

  const notes = [];
  if (!guests.length) notes.push(note('No guests yet. Add guests to make their labels.'));
  if (guests.length && !returnReady) notes.push(note('Add a return address to make the return labels.', true));
  if (missing.length) {
    const who = missing.length === 1 ? '1 guest has' : `${missing.length} guests have`;
    notes.push(note(`${who} no address yet, so no delivery label: ${missing.join(', ')}.`, true));
  }

  const returnSheets = sheetsOf('Return address labels', returnLabels, perSheet);
  const deliverySheets = sheetsOf('Delivery labels', deliveryLabels, perSheet);
  container.replaceChildren(...notes, ...returnSheets, ...deliverySheets);

  return {
    returnLabels: returnLabels.length,
    deliveryLabels: deliveryLabels.length,
    sheets: container.querySelectorAll('.label-sheet').length,
    missing: missing.length,
  };
}

/**
 * Shrinks any label line too long for its label (a long name or street) until it fits.
 * Only works while the labels are on screen, so it runs when the Labels tab is shown
 * and just before printing.
 */
export function fitLabels() {
  for (const p of container.querySelectorAll('.label p')) {
    p.style.fontSize = '';
    let size = parseFloat(getComputedStyle(p).fontSize);
    const smallest = size * 0.6;
    while (p.scrollWidth > p.clientWidth + 0.5 && size > smallest) {
      size *= 0.95;
      p.style.fontSize = `${size}px`;
    }
  }
}
