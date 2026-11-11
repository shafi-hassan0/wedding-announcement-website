// Entry point for the celebration page. Each section that does something has its
// own logic file next to its HTML and CSS in components/; this file just starts them.

import { initContact } from './components/contact/contact.js';
import { initGuestbook } from './components/guestbook/guestbook.js';
import { initNav } from './components/nav/nav.js';
import { initRsvp } from './components/rsvp/rsvp.js';
import { api } from './shared/api.js';
import { setGuest } from './shared/guest.js';
import { initHearts } from './shared/hearts.js';
import { initProgressBar, initReveals } from './shared/motion.js';

initReveals();
initProgressBar();
initHearts();

initNav();
initRsvp();
initGuestbook();
initContact();

// If this browser already RSVP'd, greet the guest and open the guestbook.
api('/api/me')
  .then((data) => {
    if (data.guest) setGuest(data.guest);
  })
  .catch(() => {});
