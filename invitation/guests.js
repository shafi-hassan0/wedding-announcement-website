// The guest list and the return address: adding, editing and removing guests,
// and saving the return address. Both are stored on the server (admin only).

import { addressFields, addressLines, hasAddress, isIncomplete } from './address.js';
import { api } from './api.js';
import { onStoreChange, store, storeChanged } from './store.js';

/* ---------- form messages ---------- */

function fieldError(message, field) {
  return Object.assign(new Error(message), { field });
}

function clearError(form) {
  form.querySelectorAll('.has-error').forEach((el) => el.classList.remove('has-error'));
  form.querySelector('.form-status').hidden = true;
}

function showError(form, err) {
  const status = form.querySelector('.form-status');
  status.textContent = err.message;
  status.hidden = false;
  const input = err.field && form.elements[err.field];
  if (input) {
    input.closest('.field')?.classList.add('has-error');
    input.focus();
  }
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* ---------- guests ---------- */

function initGuestForm() {
  const form = document.getElementById('guest-form');
  const fields = addressFields(form);
  const submit = document.getElementById('guest-submit');
  const cancel = document.getElementById('guest-cancel');
  const list = document.getElementById('guest-list');
  const tally = document.getElementById('guest-count');
  let editingId = null;

  const stopEditing = () => {
    editingId = null;
    fields.clear();
    clearError(form);
    submit.textContent = 'Add guest';
    cancel.hidden = true;
    renderList();
  };

  const startEditing = (invitee) => {
    editingId = invitee.id;
    fields.set(invitee);
    clearError(form);
    submit.textContent = 'Save changes';
    cancel.hidden = false;
    renderList();
    form.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    fields.focus();
  };

  const remove = async (invitee) => {
    if (!confirm(`Remove ${invitee.name} from the guest list?\n\nTheir address is deleted too.`)) return;
    try {
      await api(`/api/admin/invitees/${invitee.id}`, { action: 'delete' });
    } catch (err) {
      alert(err.message);
      return;
    }
    store.invitees = store.invitees.filter((i) => i.id !== invitee.id);
    if (editingId === invitee.id) stopEditing();
    storeChanged();
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError(form);
    const address = fields.get();
    if (!address.name) {
      showError(form, fieldError('Please enter a name.', 'name'));
      return;
    }

    submit.disabled = true;
    try {
      if (editingId === null) {
        const { invitee } = await api('/api/admin/invitees', address);
        store.invitees.push(invitee);
        fields.clear();
        fields.focus(); // ready for the next guest
      } else {
        const { invitee } = await api(`/api/admin/invitees/${editingId}`, { action: 'update', ...address });
        store.invitees = store.invitees.map((i) => (i.id === invitee.id ? invitee : i));
        stopEditing();
      }
      storeChanged();
    } catch (err) {
      showError(form, err);
    } finally {
      submit.disabled = false;
    }
  });

  cancel.addEventListener('click', stopEditing);

  // One line per guest: name, address (or what is missing), Edit and Remove.
  function renderList() {
    tally.textContent = store.invitees.length ? `(${store.invitees.length})` : '';
    list.replaceChildren(...store.invitees.map((invitee) => {
      const item = el('li', invitee.id === editingId ? 'guest is-editing' : 'guest');

      const info = el('div', 'guest-info');
      info.append(el('p', 'guest-name-line', invitee.name));
      if (!hasAddress(invitee)) {
        info.append(el('p', 'guest-address is-missing', 'No address yet, so no delivery label'));
      } else {
        const text = addressLines(invitee).join(', ');
        const address = el('p', isIncomplete(invitee) ? 'guest-address is-missing' : 'guest-address', text);
        if (isIncomplete(invitee)) address.append(' (missing city, state or ZIP)');
        info.append(address);
      }

      const actions = el('div', 'guest-actions');
      const edit = el('button', 'link-button', 'Edit');
      edit.type = 'button';
      edit.setAttribute('aria-label', `Edit ${invitee.name}`);
      edit.addEventListener('click', () => startEditing(invitee));
      const del = el('button', 'link-button', 'Remove');
      del.type = 'button';
      del.setAttribute('aria-label', `Remove ${invitee.name}`);
      del.addEventListener('click', () => remove(invitee));
      actions.append(edit, del);

      item.append(info, actions);
      return item;
    }));
  }

  onStoreChange(renderList);
}

/* ---------- return address ---------- */

function initReturnForm() {
  const form = document.getElementById('return-form');
  const fields = addressFields(form);
  const saved = document.getElementById('return-saved');
  const button = form.querySelector('button[type="submit"]');
  let savedTimer;

  fields.set(store.returnAddress);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError(form);
    button.disabled = true;
    try {
      const { returnAddress } = await api('/api/admin/return-address', fields.get());
      store.returnAddress = returnAddress;
      storeChanged();
      saved.hidden = false;
      clearTimeout(savedTimer);
      savedTimer = setTimeout(() => { saved.hidden = true; }, 2500);
    } catch (err) {
      showError(form, err);
    } finally {
      button.disabled = false;
    }
  });
}

/** Call once the guest list and return address have been loaded into the store. */
export function initGuests() {
  initGuestForm();
  initReturnForm();
}
