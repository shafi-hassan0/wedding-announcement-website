// Nav bar: the phone menu. The three-line button opens a panel of section links;
// it closes when a link is chosen, on Escape, on a tap elsewhere, or when the
// window becomes wide enough for the links to sit in the bar. Styles are in nav.css.

export function initNav() {
  const nav = document.querySelector('.nav');
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');

  const isOpen = () => nav.classList.contains('is-open');

  const setOpen = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };

  toggle.hidden = false;
  toggle.addEventListener('click', () => setOpen(!isOpen()));

  // Choosing a section closes the menu so the section is not hidden behind it.
  links.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isOpen()) return;
    setOpen(false);
    toggle.focus();
  });

  document.addEventListener('click', (event) => {
    if (isOpen() && !nav.contains(event.target)) setOpen(false);
  });

  // Matches the breakpoint in nav.css.
  window.matchMedia('(min-width: 900px)').addEventListener('change', (event) => {
    if (event.matches) setOpen(false);
  });
}
