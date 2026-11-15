// The invitations: one card per guest, laid out on the chosen paper. Styles are in card.css.

import { store } from './store.js';

// Paper choices. "perSheet" is how many invitations share one printed page. "flip" is
// the double-sided setting that puts each back the right way up when a card is turned
// over sideways, like a page in a book: the cards stand upright on a landscape letter
// sheet, so that sheet turns on its short edge.
export const PAPER = {
  letter: { page: '@page { size: 11in 8.5in; margin: 0; }', perSheet: 2, flip: 'short' },
  card: { page: '@page { size: 5in 7in; margin: 0; }', perSheet: 1, flip: 'long' },
};

const container = document.getElementById('cards');
const template = document.getElementById('card-template');
const backTemplate = document.getElementById('card-back-template');

function buildCard(name) {
  const card = template.content.firstElementChild.cloneNode(true);
  card.querySelector('.guest-name').textContent = name;
  card.querySelector('.invite-code').textContent = store.inviteCode;
  return card;
}

const buildBack = () => backTemplate.content.firstElementChild.cloneNode(true);

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

function note(text) {
  const p = document.createElement('p');
  p.className = 'preview-note';
  p.textContent = text;
  return p;
}

/** Redraws the invitations. Returns counts for the summary under the PDF button. */
export function renderCards() {
  const paper = PAPER[store.paper];
  const twoUp = paper.perSheet > 1;
  // With no guests yet, show one invitation with a blank line to write a name on.
  const names = store.invitees.length ? store.invitees.map((invitee) => invitee.name) : [''];

  // A sheet is one printed page. Inside it, the trim box holds the cards; its edges are the cut lines.
  const buildSheet = (cards) => {
    const trim = document.createElement('div');
    trim.className = 'trim';
    trim.append(...cards);
    if (twoUp) trim.append(...cropMarks(cards.length));

    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.append(trim);
    return sheet;
  };

  const sheets = [];
  for (let i = 0; i < names.length; i += paper.perSheet) {
    const group = names.slice(i, i + paper.perSheet);
    sheets.push(buildSheet(group.map(buildCard)));
    // The back of that same sheet comes next. Every back is identical and sits in the same
    // centred layout as the fronts, so each one lands behind its own card when printed double-sided.
    if (store.backs) sheets.push(buildSheet(group.map(buildBack)));
  }

  const notes = store.invitees.length
    ? []
    : [note('No guests yet. Add guests to get one invitation each. Until then, this sample has a blank line for a name.')];
  container.classList.toggle('two-up', twoUp);
  container.replaceChildren(...notes, ...sheets);

  return { invitations: names.length, sheets: sheets.length, backs: store.backs, flip: paper.flip, page: paper.page };
}
