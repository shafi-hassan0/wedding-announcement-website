// Invitation maker: entry point. Loads the guest list and return address from the
// server, then starts each part of the page:
//
//   guests.js    the guest list and return address forms
//   cards.js     the invitations           (card.css)
//   labels.js    the envelope labels       (labels.css)
//   preview.js   the preview tabs and printing
//
// Only a signed-in admin is served this page (see server/routes/invitations.js).

import { api } from './api.js';
import { PAPER, renderCards } from './cards.js';
import { initGuests } from './guests.js';
import { LABEL_PAGE, LABEL_STOCK, fitLabels, renderLabels } from './labels.js';
import { currentView, initPreview, printView } from './preview.js';
import { onStoreChange, store, storeChanged } from './store.js';

// The paper choices are remembered in this browser. Names and addresses are not; they live on the server.
const PRINT_SETTINGS_KEY = 'invitation-print-settings';

const paperInput = document.getElementById('paper');
const stockInput = document.getElementById('label-stock');
const invitationsSummary = document.getElementById('invitations-summary');
const labelsSummary = document.getElementById('labels-summary');

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

function loadPrintSettings() {
  try {
    // Older versions of this page kept guest names in the browser. Clear them out.
    localStorage.removeItem('invitation-settings');
    const saved = JSON.parse(localStorage.getItem(PRINT_SETTINGS_KEY)) || {};
    if (saved.paper in PAPER) store.paper = saved.paper;
    if (saved.labelStock in LABEL_STOCK) store.labelStock = saved.labelStock;
  } catch {
    // Storage blocked or empty: use the defaults.
  }
  paperInput.value = store.paper;
  stockInput.value = store.labelStock;
}

function savePrintSettings() {
  try {
    localStorage.setItem(PRINT_SETTINGS_KEY, JSON.stringify({ paper: store.paper, labelStock: store.labelStock }));
  } catch {
    // Storage blocked: the page still works, it just will not remember.
  }
}

function render() {
  const cards = renderCards();
  invitationsSummary.textContent = `${plural(cards.invitations, 'invitation')} on ${plural(cards.sheets, 'page')}.`;

  const labels = renderLabels();
  const parts = [`${plural(labels.returnLabels, 'return label')} and ${plural(labels.deliveryLabels, 'delivery label')}`];
  parts.push(`on ${plural(labels.sheets, 'label sheet')}.`);
  labelsSummary.textContent = parts.join(' ');

  if (currentView() === 'labels') fitLabels();
}

async function start() {
  loadPrintSettings();

  try {
    const [list, code] = await Promise.all([api('/api/admin/invitees'), api('/api/admin/invite-code')]);
    store.invitees = list.invitees;
    store.returnAddress = list.returnAddress;
    store.inviteCode = code.code;
  } catch (err) {
    const intro = document.querySelector('.panel-intro');
    intro.textContent = `Could not load the guest list: ${err.message}`;
    intro.classList.add('form-status');
    return;
  }
  document.getElementById('code').value = store.inviteCode;

  initGuests();
  initPreview((view) => {
    if (view === 'labels') fitLabels();
  });
  onStoreChange(render);

  paperInput.addEventListener('change', () => {
    store.paper = paperInput.value;
    savePrintSettings();
    storeChanged();
  });
  stockInput.addEventListener('change', () => {
    store.labelStock = stockInput.value;
    savePrintSettings();
    storeChanged();
  });

  document.getElementById('print-invitations').addEventListener('click', () => {
    printView('invitations', PAPER[store.paper].page);
  });
  document.getElementById('print-labels').addEventListener('click', () => {
    printView('labels', LABEL_PAGE);
  });

  storeChanged();
}

start();
