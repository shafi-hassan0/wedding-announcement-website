// Invitation maker. Turns the list of guest names into one invitation each,
// stamps the site's invite code on all of them, and lays them out for printing.
// Only a signed-in admin is served this page (see server/routes/invitations.js).

const STORAGE_KEY = 'invitation-settings';

const namesInput = document.getElementById('names');
const codeInput = document.getElementById('code');
const paperInput = document.getElementById('paper');
const cards = document.getElementById('cards');
const template = document.getElementById('card-template');
const countLine = document.getElementById('count');

// Paper sizes. "perSheet" is how many invitations share one printed page.
const PAPER = {
  letter: { page: '@page { size: 11in 8.5in; margin: 0; }', perSheet: 2 },
  card: { page: '@page { size: 5in 7in; margin: 0; }', perSheet: 1 },
};

let inviteCode = '';

/* ---------- page size ---------- */

// The printed page size is an @page rule, which a class cannot switch. We add it to
// this page's own stylesheet and replace it when the Paper setting changes.
const sheet = document.getElementById('invitation-styles').sheet;
let pageRuleIndex = null;

function setPageSize(rule) {
  if (pageRuleIndex !== null) sheet.deleteRule(pageRuleIndex);
  pageRuleIndex = sheet.insertRule(rule, sheet.cssRules.length);
}

/* ---------- remembering what was typed ---------- */

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    namesInput.value = saved.names || '';
    if (saved.paper in PAPER) paperInput.value = saved.paper;
  } catch {
    // Storage blocked or empty: start with blank settings.
  }
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ names: namesInput.value, paper: paperInput.value }));
  } catch {
    // Storage blocked: the page still works, it just will not remember.
  }
}

/* ---------- the invite code ---------- */

// Fetched from the website itself, so the printed code can never differ from the one guests must type.
async function loadInviteCode() {
  const res = await fetch('/api/admin/invite-code', { credentials: 'same-origin' });
  if (res.status === 401) {
    window.location.href = '/admin'; // signed out in the meantime
    return;
  }
  if (!res.ok) throw new Error('Could not load the invite code.');
  inviteCode = (await res.json()).code;
  codeInput.value = inviteCode;
}

/* ---------- building the invitations ---------- */

function guestNames() {
  const names = namesInput.value.split('\n').map((line) => line.trim()).filter(Boolean);
  // No names: one invitation with a blank line to write on by hand.
  return names.length ? names : [''];
}

function buildCard(name) {
  const card = template.content.firstElementChild.cloneNode(true);
  card.querySelector('.guest-name').textContent = name;
  card.querySelector('.invite-code').textContent = inviteCode;
  return card;
}

/** The short lines in a sheet's margins that show the print shop where to cut. */
function cropMarks(cardCount) {
  const columns = cardCount > 1 ? ['at-left', 'at-middle', 'at-right'] : ['at-left', 'at-right'];
  const classes = [];
  for (const row of ['at-top', 'at-bottom']) {
    for (const column of columns) classes.push(`mark mark-v ${row} ${column}`); // vertical cuts
    for (const side of ['at-left', 'at-right']) classes.push(`mark mark-h ${row} ${side}`); // horizontal cuts
  }
  return classes.map((className) => {
    const mark = document.createElement('span');
    mark.className = className;
    mark.setAttribute('aria-hidden', 'true');
    return mark;
  });
}

function render() {
  const names = guestNames();
  const paper = PAPER[paperInput.value];
  const twoUp = paper.perSheet > 1;

  // A sheet is one printed page. Inside it, the trim box holds the cards; its edges are the cut lines.
  const sheets = [];
  for (let i = 0; i < names.length; i += paper.perSheet) {
    const group = names.slice(i, i + paper.perSheet);
    const trim = document.createElement('div');
    trim.className = 'trim';
    trim.append(...group.map(buildCard));
    if (twoUp) trim.append(...cropMarks(group.length));

    const sheetEl = document.createElement('div');
    sheetEl.className = 'sheet';
    sheetEl.append(trim);
    sheets.push(sheetEl);
  }
  cards.replaceChildren(...sheets);
  cards.classList.toggle('two-up', twoUp);
  setPageSize(paper.page);

  const invitations = names.length === 1 ? '1 invitation' : `${names.length} invitations`;
  const pages = sheets.length === 1 ? '1 page' : `${sheets.length} pages`;
  countLine.textContent = `${invitations}, ${pages}.`;
}

/* ---------- start ---------- */

for (const input of [namesInput, paperInput]) {
  input.addEventListener('input', () => {
    saveSettings();
    render();
  });
}

document.getElementById('print').addEventListener('click', () => window.print());

loadSettings();
render();
loadInviteCode().then(render).catch((err) => {
  codeInput.value = err.message;
});
