// Admin page, "Updates": write a new update, and edit or delete published ones.
// Comment moderation is drawn by admin.js with the same cards as guestbook notes.

import { api } from '../shared/api.js';
import { $, el, when } from './dom.js';

let editingId = null;
let reload = () => {};

function stopEditing() {
  editingId = null;
  $('post-form').reset();
  $('post-form-title').textContent = 'Write an update';
  $('post-submit').textContent = 'Publish';
  $('post-cancel').hidden = true;
}

function startEditing(post) {
  editingId = post.id;
  const form = $('post-form');
  form.elements.title.value = post.title;
  form.elements.body.value = post.body;
  $('post-form-title').textContent = 'Edit this update';
  $('post-submit').textContent = 'Save changes';
  $('post-cancel').hidden = false;
  form.scrollIntoView({ block: 'center', behavior: 'smooth' });
  form.elements.title.focus({ preventScroll: true });
}

/** Sets up the form. `onChange` is called after anything is published, saved or deleted. */
export function initPosts(onChange) {
  reload = onChange;
  const form = $('post-form');
  const status = form.querySelector('.form-status');

  $('post-cancel').addEventListener('click', stopEditing);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    status.hidden = true;
    const post = { title: form.elements.title.value, body: form.elements.body.value };
    $('post-submit').disabled = true;
    try {
      if (editingId === null) await api('/api/admin/posts', post);
      else await api(`/api/admin/posts/${editingId}`, { action: 'update', ...post });
      stopEditing();
      reload();
    } catch (err) {
      status.textContent = err.message;
      status.hidden = false;
      if (err.field) form.elements[err.field]?.focus();
    } finally {
      $('post-submit').disabled = false;
    }
  });
}

function postCard(post) {
  const card = el('div', 'card admin-note');
  card.append(el('h3', 'admin-post-title', post.title));
  const edited = post.updated_at !== post.created_at ? ` · edited ${when(post.updated_at)}` : '';
  card.append(el('p', 'note-meta', `Published ${when(post.created_at)}${edited}`));
  card.append(el('p', 'admin-post-body', post.body));

  const actions = el('div', 'admin-actions');
  const edit = el('button', 'btn btn-outline', 'Edit');
  edit.type = 'button';
  edit.addEventListener('click', () => startEditing(post));

  const remove = el('button', 'btn btn-outline', 'Delete');
  remove.type = 'button';
  remove.addEventListener('click', async () => {
    if (!confirm(`Delete "${post.title}"?\n\nIts comments are deleted too. This cannot be undone.`)) return;
    remove.disabled = true;
    try {
      await api(`/api/admin/posts/${post.id}`, { action: 'delete' });
      if (editingId === post.id) stopEditing();
    } catch (err) {
      alert(err.message);
    }
    reload();
  });

  actions.append(edit, remove);
  card.append(actions);
  return card;
}

/** Draws the list of published updates. */
export function renderPosts(posts) {
  $('posts').replaceChildren(...(posts.length ? posts.map(postCard) : [el('p', 'empty', 'No updates published yet.')]));
}
