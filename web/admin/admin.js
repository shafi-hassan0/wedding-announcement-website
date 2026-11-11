// Admin page: review RSVPs, approve guestbook notes, read contact messages.

import { api } from '../shared/api.js';

const $ = (id) => document.getElementById(id);

// Builds an element; all text goes in as text, never as HTML.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function when(iso) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function show(loggedIn) {
  $('login').hidden = loggedIn;
  $('dashboard').hidden = !loggedIn;
}

function row(cells) {
  const tr = el('tr');
  for (const [text, className] of cells) tr.append(el('td', className, text));
  return tr;
}

function emptyRow(columns, text) {
  const tr = el('tr');
  const td = el('td', 'empty', text);
  td.colSpan = columns;
  tr.append(td);
  return tr;
}

/**
 * A table cell holding a Delete button. Clicking it asks first, then posts the
 * delete to `url` and reloads the page's data.
 */
function deleteCell(label, question, url) {
  const button = el('button', 'btn btn-outline btn-row', 'Delete');
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.addEventListener('click', async () => {
    if (!confirm(question)) return;
    button.disabled = true;
    try {
      await api(url, { action: 'delete' });
    } catch (err) {
      alert(err.message);
    }
    load();
  });

  const cell = el('td');
  cell.append(button);
  return cell;
}

/** One line of the RSVP table. */
function rsvpRow(rsvp) {
  const tr = row([
    [rsvp.name], [rsvp.attending ? 'Yes' : 'No'], [rsvp.attending ? String(1 + rsvp.guests) : '-'],
    [rsvp.contact_raw], [rsvp.dietary || '-', 'wrap'], [rsvp.note || '-', 'wrap'], [when(rsvp.updated_at)],
  ]);
  tr.append(deleteCell(
    `Delete the RSVP from ${rsvp.name}`,
    `Delete the RSVP from ${rsvp.name}?\n\nAny guestbook notes they left are deleted too. This cannot be undone.`,
    `/api/admin/rsvps/${rsvp.id}`
  ));
  return tr;
}

/** One line of the contact messages table. */
function contactRow(message) {
  const tr = row([[message.name], [message.reply_to], [message.message, 'wrap'], [when(message.created_at)]]);
  tr.append(deleteCell(
    `Delete the message from ${message.name}`,
    `Delete the message from ${message.name}?\n\nThis cannot be undone.`,
    `/api/admin/contacts/${message.id}`
  ));
  return tr;
}

function noteCard(note) {
  const card = el('div', 'card admin-note');
  card.append(el('p', 'note-message', note.message));
  const meta = el('p', 'note-meta');
  meta.append(el('span', 'note-name', note.name), ` · ${when(note.created_at)}`);
  meta.append(el('span', note.status === 'approved' ? 'badge badge-ok' : 'badge', note.status === 'approved' ? 'On the site' : 'Waiting'));
  card.append(meta);

  const actions = el('div', 'admin-actions');
  const act = (label, action, className, confirmText) => {
    const button = el('button', className, label);
    button.type = 'button';
    button.addEventListener('click', async () => {
      if (confirmText && !confirm(confirmText)) return;
      button.disabled = true;
      await api(`/api/admin/notes/${note.id}`, { action });
      load();
    });
    actions.append(button);
  };
  if (note.status === 'approved') act('Take off the site', 'hide', 'btn btn-outline');
  else act('Approve', 'approve', 'btn');
  act('Delete', 'delete', 'btn btn-outline', 'Delete this note for good?');
  card.append(actions);
  return card;
}

async function load() {
  let data;
  try {
    data = await api('/api/admin/data');
  } catch (err) {
    show(false);
    return;
  }
  show(true);

  const stats = [
    [data.totals.headcount, 'People coming'],
    [data.totals.households, 'Said yes'],
    [data.totals.declined, 'Said no'],
    [data.totals.responses, 'Responses'],
    [data.totals.pendingNotes, 'Notes to review'],
  ];
  $('stats').replaceChildren(...stats.map(([value, label]) => {
    const card = el('div', 'card stat');
    card.append(el('span', 'stat-value', String(value)), el('span', 'stat-label', label));
    return card;
  }));

  const pending = data.notes.filter((n) => n.status !== 'approved');
  const approved = data.notes.filter((n) => n.status === 'approved');
  $('pending').replaceChildren(...(pending.length ? pending.map(noteCard) : [el('p', 'empty', 'Nothing waiting. You are all caught up.')]));
  $('approved').replaceChildren(...(approved.length ? approved.map(noteCard) : [el('p', 'empty', 'No approved notes yet.')]));

  $('rsvps').replaceChildren(...(data.rsvps.length ? data.rsvps.map(rsvpRow) : [emptyRow(8, 'No RSVPs yet.')]));

  $('contacts').replaceChildren(...(data.contacts.length ? data.contacts.map(contactRow) : [emptyRow(5, 'No messages yet.')]));
}

$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const status = event.target.querySelector('.form-status');
  status.hidden = true;
  try {
    await api('/api/admin/login', { password: $('password').value });
    $('password').value = '';
    load();
  } catch (err) {
    status.textContent = err.message;
    status.hidden = false;
  }
});

$('refresh').addEventListener('click', load);
$('logout').addEventListener('click', async () => {
  await api('/api/admin/logout', {});
  show(false);
});

load();
