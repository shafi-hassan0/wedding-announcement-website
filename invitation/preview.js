// The preview tabs (Invitations / Labels), and printing one of them as its own PDF.

const VIEWS = ['invitations', 'labels'];
const tabs = Object.fromEntries(VIEWS.map((name) => [name, document.getElementById(`tab-${name}`)]));
const panels = { invitations: document.getElementById('cards'), labels: document.getElementById('labels') };

let current = 'invitations';
let onShow = () => {};

/** Which tab is showing. */
export function currentView() {
  return current;
}

/** Shows one tab's preview. */
export function showView(name) {
  current = name;
  for (const view of VIEWS) {
    tabs[view].setAttribute('aria-selected', String(view === name));
    panels[view].classList.toggle('is-active', view === name);
  }
  onShow(name);
}

/** Sets up the tabs. `handler(name)` runs whenever a tab is shown. */
export function initPreview(handler) {
  onShow = handler;
  for (const view of VIEWS) tabs[view].addEventListener('click', () => showView(view));
}

/* ---------- printing ---------- */

// The printed page size is an @page rule, which a class cannot switch. We add it to
// page.css and replace it each time, since the two PDFs use different paper.
let pageRuleIndex = null;

function setPageSize(rule) {
  const sheet = document.getElementById('page-styles').sheet;
  if (pageRuleIndex !== null) sheet.deleteRule(pageRuleIndex);
  pageRuleIndex = sheet.insertRule(rule, sheet.cssRules.length);
}

/** Opens the print window for one tab only, on its own paper size. */
export function printView(name, pageRule) {
  showView(name); // so you can see what is being printed
  document.body.dataset.print = name;
  setPageSize(pageRule);
  window.print();
}

window.addEventListener('afterprint', () => {
  delete document.body.dataset.print;
});
