// RSVP section: the form, and the "you're on the list" panel that replaces it.

import { api } from '../../shared/api.js';
import { fieldError, onSubmit, showPanel } from '../../shared/forms.js';
import { onGuestChange, setGuest } from '../../shared/guest.js';
import { reducedMotion } from '../../shared/motion.js';

export function initRsvp() {
  const form = document.getElementById('rsvp-form');
  const done = document.getElementById('rsvp-done');
  const doneTitle = document.getElementById('rsvp-done-title');
  const doneText = document.getElementById('rsvp-done-text');
  const guestsField = document.getElementById('rsvp-guests-field');
  const dietaryField = document.getElementById('rsvp-dietary-field');

  // "How many are coming" and "dietary needs" only matter if the guest is coming.
  const syncAttendingFields = () => {
    const coming = form.elements.attending.value !== 'no';
    guestsField.hidden = !coming;
    dietaryField.hidden = !coming;
  };
  form.addEventListener('change', syncAttendingFields);
  syncAttendingFields();

  // Whenever we know who the guest is (they just RSVP'd, signed in, or came back
  // on the same device), show the confirmation in place of the form.
  onGuestChange((guest) => {
    if (!guest) {
      done.hidden = true;
      form.hidden = false;
      return;
    }
    doneTitle.textContent = guest.attending ? 'You just made their day!' : 'You’ll be missed!';
    doneText.textContent = guest.attending
      ? `Shafi and Phoenix can’t wait to celebrate with you, ${guest.firstName}.`
      : 'Thank you for letting them know. You’ll be there in spirit.';
    form.hidden = true;
    done.hidden = false;
  });

  onSubmit(form, async (data) => {
    const attending = data.get('attending');
    if (!data.get('code').trim()) throw fieldError('Please enter the invite code from your invitation.', 'code');
    if (!data.get('name').trim()) throw fieldError('Please enter your full name.', 'name');
    if (!data.get('contact').trim()) throw fieldError('Please enter a phone number or email.', 'contact');
    if (!attending) throw fieldError('Please let them know if you can make it.', 'attending');

    const coming = attending === 'yes';
    const result = await api('/api/rsvp', {
      code: data.get('code'),
      name: data.get('name'),
      contact: data.get('contact'),
      attending: coming,
      guests: coming ? Number(data.get('guests')) : 0,
      dietary: coming ? data.get('dietary') : '',
      note: data.get('note'),
      website: data.get('website'), // honeypot; real guests never fill this in
    });
    if (!result.guest) return;

    setGuest(result.guest);
    showPanel(done);
    if (result.guest.attending) heartBurst(done);
  });

  // "Change my RSVP" brings the form back. Sending it again updates the same RSVP.
  document.getElementById('rsvp-change').addEventListener('click', () => {
    done.hidden = true;
    form.hidden = false;
    form.elements.code.focus();
  });
}

/** A little burst of hearts out of the confirmation panel. Styles are in rsvp.css. */
function heartBurst(panel) {
  if (reducedMotion) return;

  const burst = document.createElement('div');
  burst.className = 'burst';
  burst.setAttribute('aria-hidden', 'true');

  const count = 16;
  for (let i = 0; i < count; i++) {
    const heart = document.createElement('span');
    heart.textContent = '♥';
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const distance = 90 + Math.random() * 110;
    heart.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
    heart.style.setProperty('--dy', `${Math.sin(angle) * distance - 30}px`);
    heart.style.setProperty('--rot', `${Math.random() * 80 - 40}deg`);
    heart.style.animationDelay = `${Math.random() * 0.25}s`;
    burst.append(heart);
  }

  panel.append(burst);
  setTimeout(() => burst.remove(), 2400);
}
