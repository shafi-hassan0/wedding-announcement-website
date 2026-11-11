// Guestbook section. It is locked until the guest has RSVP'd (or signed in on a
// new device); then it shows the note form and the wall of approved notes.

import { api } from '../../shared/api.js';
import { fieldError, onSubmit } from '../../shared/forms.js';
import { onGuestChange, setGuest } from '../../shared/guest.js';
import { refreshReveals } from '../../shared/motion.js';

const MAX_LENGTH = 500;

export function initGuestbook() {
  const locked = document.getElementById('guestbook-locked');
  const open = document.getElementById('guestbook-open');
  const greeting = document.getElementById('guestbook-greeting');
  const pendingLine = document.getElementById('note-pending');

  onGuestChange((guest) => {
    locked.hidden = !!guest;
    open.hidden = !guest;
    refreshReveals(); // the page below just moved
    if (!guest) return;
    greeting.textContent = `Welcome back, ${guest.firstName}!`;
    loadNotes();
  });

  initSignIn(greeting);
  initNoteForm(pendingLine);
}

/** "Already RSVP'd? Sign in": for a returning guest on a new device. */
function initSignIn(greeting) {
  const form = document.getElementById('signin-form');
  const toggle = document.getElementById('signin-toggle');

  toggle.addEventListener('click', () => {
    const opening = form.hidden;
    form.hidden = !opening;
    toggle.setAttribute('aria-expanded', String(opening));
    if (opening) form.elements.code.focus();
  });

  onSubmit(form, async (data) => {
    const result = await api('/api/signin', { code: data.get('code'), contact: data.get('contact') });
    setGuest(result.guest);
    greeting.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}

function initNoteForm(pendingLine) {
  const form = document.getElementById('note-form');
  const message = document.getElementById('note-message');
  const counter = document.getElementById('note-count');

  const updateCounter = () => {
    counter.textContent = `${message.value.length} / ${MAX_LENGTH}`;
  };
  message.addEventListener('input', updateCounter);

  onSubmit(form, async (data) => {
    if (!data.get('message').trim()) throw fieldError('Please write a message first.', 'message');
    await api('/api/guestbook', { message: data.get('message') });
    form.reset();
    updateCounter();
    pendingLine.textContent = 'Thank you! Your note is on its way to Shafi and Phoenix, and it will appear here soon.';
    pendingLine.hidden = false;
  });
}

/** Fetches the approved notes and draws the wall. */
async function loadNotes() {
  let data;
  try {
    data = await api('/api/guestbook');
  } catch (err) {
    // The server no longer recognises this guest (for example their RSVP was removed).
    if (err.status === 401) setGuest(null);
    return;
  }

  const wall = document.getElementById('wall');
  wall.replaceChildren(...data.notes.map(noteCard));
  document.getElementById('wall-empty').hidden = data.notes.length > 0;

  if (data.pending > 0) {
    const pendingLine = document.getElementById('note-pending');
    pendingLine.textContent = data.pending === 1
      ? 'Your note is waiting for Shafi and Phoenix to read it. It will appear here soon.'
      : `Your ${data.pending} notes are waiting for Shafi and Phoenix to read them. They will appear here soon.`;
    pendingLine.hidden = false;
  }
  refreshReveals();
}

/** One note on the wall. Guest text always goes in as plain text, never as HTML. */
function noteCard(note) {
  const card = document.createElement('article');
  card.className = 'note';

  const message = document.createElement('p');
  message.className = 'note-message';
  message.textContent = note.message;

  const name = document.createElement('span');
  name.className = 'note-name';
  name.textContent = note.name;

  const date = new Date(note.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const meta = document.createElement('p');
  meta.className = 'note-meta';
  meta.append(name, ` · ${date}`);

  card.append(message, meta);
  return card;
}
