// Scroll animations: blocks fade and slide into place as they come on screen, and a
// thin line across the top of the window fills as the guest reads down the page.
// The matching styles are in motion.css (and in each section's own CSS file).
//
// Guests whose device asks for reduced motion get none of this.

export const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Which blocks animate, and how: [selector, direction, stagger siblings one after another?]
const REVEALS = [
  ['.section-head', 'up'],
  ['.split > .frame, .chapter:not(.chapter-flip) > .frame, .details', 'left'],
  ['.chapter-flip > .frame, .shelter', 'right'],
  ['.split > .prose, .chapter:not(.chapter-flip) > .prose', 'right'],
  ['.chapter-flip > .prose', 'left'],
  ['.timeline-wrap > h3, .timeline-wrap > .tagline, .food-notes, .wall-wrap', 'up'],
  ['.timeline li', 'up', true],
  ['.menu-card', 'up', true],
  ['.faq-item', 'up', true],
  ['.form-card', 'zoom'],
  ['#gifts .container > *', 'up', true],
  ['.footer .container > *', 'up', true],
];

let scheduleCheck = () => {};

/**
 * Re-checks which blocks are on screen. Call this after showing or hiding part of
 * the page (for example when the guestbook opens), since that moves everything below it.
 */
export function refreshReveals() {
  scheduleCheck();
}

/**
 * Starts the scroll animations. A block animates in whenever it comes on screen and
 * resets once it has fully left, so it plays again in either scroll direction.
 */
export function initReveals() {
  if (reducedMotion) return;

  const items = [];
  const settleTimers = new WeakMap();

  for (const [selector, direction, stagger] of REVEALS) {
    document.querySelectorAll(selector).forEach((el) => {
      el.classList.add('reveal');
      if (direction !== 'up') el.classList.add(`reveal-${direction}`);
      if (stagger) {
        const index = [...el.parentElement.children].indexOf(el);
        if (index > 0) el.classList.add(`reveal-d${Math.min(index, 5)}`);
      }
      items.push(el);
    });
  }
  // The timeline's line draws itself; see celebration.css.
  document.querySelectorAll('.timeline').forEach((el) => {
    el.classList.add('grow');
    items.push(el);
  });

  // Position on the page from layout alone, ignoring the slide and zoom transforms,
  // so a block's own animation can never change whether it counts as on screen.
  const pageTop = (el) => {
    let y = 0;
    for (let node = el; node; node = node.offsetParent) y += node.offsetTop;
    return y;
  };

  const show = (el) => {
    if (el.classList.contains('is-visible')) return;
    el.classList.remove('from-above');
    el.classList.add('is-visible');
    // Once it has landed, mark it settled so the stagger delay stops applying to hover effects.
    settleTimers.set(el, setTimeout(() => el.classList.add('settled'), 1700));
  };

  const hide = (el, leftThroughTop) => {
    // Blocks that left through the top of the screen come back in from above.
    el.classList.toggle('from-above', leftThroughTop);
    if (!el.classList.contains('is-visible')) return;
    clearTimeout(settleTimers.get(el));
    el.classList.remove('is-visible', 'settled');
  };

  const check = () => {
    const viewport = window.innerHeight;
    const scrollY = window.scrollY;
    // A block counts as on screen once it is a little way in from the edge. At the very
    // end of the page nothing can scroll further in, so there the edge itself is enough.
    const atEnd = scrollY + viewport >= document.documentElement.scrollHeight - 4;
    const margin = atEnd ? 0 : Math.min(viewport * 0.08, 48);

    for (const el of items) {
      if (el.offsetParent === null) continue; // not displayed right now
      const top = pageTop(el) - scrollY;
      const bottom = top + el.offsetHeight;
      if (bottom > margin && top < viewport - margin) show(el);
      else if (bottom < 0) hide(el, true);
      else if (top > viewport) hide(el, false);
    }
  };

  let queued = false;
  scheduleCheck = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      check();
    });
  };

  window.addEventListener('scroll', scheduleCheck, { passive: true });
  window.addEventListener('resize', scheduleCheck);
  window.addEventListener('load', scheduleCheck);
  check();
}

/** Adds the thin line at the top of the window that fills as the guest scrolls down. */
export function initProgressBar() {
  if (reducedMotion) return;

  const bar = document.createElement('div');
  bar.className = 'scroll-progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.append(bar);

  let queued = false;
  const update = () => {
    queued = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(window.scrollY / max, 1) : 0})`;
  };
  window.addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }, { passive: true });
  update();
}
