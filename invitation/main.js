// Invitation maker: entry point. Loads the guest list and return address from the
// server, then starts each part of the page:
//
//   guests.js    the guest list and return address forms
//   cards.js     the invitations                        (card.css)
//   labels.js    the return and delivery labels         (labels.css)
//   preview.js   the preview tabs and printing
//
// Only a signed-in admin is served this page (see server/routes/invitations.js).

import { api } from './api.js';
import { PAPER, renderCards } from './cards.js';
import { initGuests } from './guests.js';
import { LABEL_PAGE, LABEL_STOCK, fitLabels, isLabelView, renderLabels } from './labels.js';
import { currentView, initPreview, printView } from './preview.js';
import { onStoreChange, store, storeChanged } from './store.js';

// The paper choices are remembered in this browser. Names and addresses are not; they live on the server.
const PRINT_SETTINGS_KEY = 'invitation-print-settings';

const paperInput = document.getElementById('paper');
const backsInput = document.getElementById('backs');
const returnStockInput = document.getElementById('return-stock');
const deliveryStockInput = document.getElementById('delivery-stock');
const invitationsSummary = document.getElementById('invitations-summary');
const returnSummary = document.getElementById('return-summary');
const deliverySummary = document.getElementById('delivery-summary');

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

function loadPrintSettings() {
  try {
    // Older versions of this page kept guest names in the browser. Clear them out.
    localStorage.removeItem('invitation-settings');
    const saved = JSON.parse(localStorage.getItem(PRINT_SETTINGS_KEY)) || {};
    if (saved.paper in PAPER) store.paper = saved.paper;
    if (typeof saved.backs === 'boolean') store.backs = saved.backs;
    // Before each set had its own choice, one "labelStock" was used for both. It carries
    // over to the return labels; the delivery labels start on 10 per sheet.
    const returnStock = saved.returnStock ?? saved.labelStock;
    if (returnStock in LABEL_STOCK) store.returnStock = returnStock;
    if (saved.deliveryStock in LABEL_STOCK) store.deliveryStock = saved.deliveryStock;
  } catch {
    // Storage blocked or empty: use the defaults.
  }
  paperInput.value = store.paper;
  backsInput.checked = store.backs;
  returnStockInput.value = store.returnStock;
  deliveryStockInput.value = store.deliveryStock;
}

function savePrintSettings() {
  try {
    const { paper, backs, returnStock, deliveryStock } = store;
    localStorage.setItem(PRINT_SETTINGS_KEY, JSON.stringify({ paper, backs, returnStock, deliveryStock }));
  } catch {
    // Storage blocked: the page still works, it just will not remember.
  }
}

function render() {
  const cards = renderCards();
  invitationsSummary.textContent = cards.backs
    ? `${plural(cards.invitations, 'invitation')} on ${plural(cards.sheets, 'page')}, fronts and backs. Print double-sided, flipping on the ${cards.flip} edge.`
    : `${plural(cards.invitations, 'invitation')} on ${plural(cards.sheets, 'page')}.`;

  const labels = renderLabels();
  returnSummary.textContent = `${plural(labels.returnLabels, 'return label')} on ${plural(labels.returnSheets, 'sheet')}.`;
  deliverySummary.textContent = `${plural(labels.deliveryLabels, 'delivery label')} on ${plural(labels.deliverySheets, 'sheet')}.`;

  if (isLabelView(currentView())) fitLabels(currentView());
}

/** Keeps a settings input in step with the store, remembers it, and redraws. */
function bindSetting(input, key, read = () => input.value) {
  input.addEventListener('change', () => {
    store[key] = read();
    savePrintSettings();
    storeChanged();
  });
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
    if (isLabelView(view)) fitLabels(view);
  });
  onStoreChange(render);

  bindSetting(paperInput, 'paper');
  bindSetting(backsInput, 'backs', () => backsInput.checked);
  bindSetting(returnStockInput, 'returnStock');
  bindSetting(deliveryStockInput, 'deliveryStock');

  document.getElementById('print-invitations').addEventListener('click', () => {
    printView('invitations', PAPER[store.paper].page);
  });
  document.getElementById('print-return').addEventListener('click', () => {
    printView('return', LABEL_PAGE);
  });
  document.getElementById('print-delivery').addEventListener('click', () => {
    printView('delivery', LABEL_PAGE);
  });

  storeChanged();
}

start();
