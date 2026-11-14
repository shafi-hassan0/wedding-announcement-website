// Updates section: posts from Shafi and Phoenix. Anyone can read them. A guest who
// has RSVP'd (or signed in) also sees the comments and can leave one; like guestbook
// notes, a comment appears once Shafi or Phoenix has approved it.

import { api } from '../../shared/api.js';
import { fieldError, onSubmit } from '../../shared/forms.js';
import { getGuest, onGuestChange } from '../../shared/guest.js';
import { refreshReveals } from '../../shared/motion.js';

const MAX_LENGTH = 500;

export function initBlog() {
  loadPosts();
  // Comments come with the posts only for a recognised guest, so fetch again when that changes.
  onGuestChange(loadPosts);
}

let latestLoad = 0;

/** Fetches the posts and draws them. If two loads overlap, only the newer one is drawn. */
async function loadPosts() {
  const thisLoad = ++latestLoad;
  let data;
  try {
    data = await api('/api/posts');
  } catch {
    return;
  }
  if (thisLoad !== latestLoad) return;

  document.getElementById('posts').replaceChildren(...data.posts.map(postCard));
  document.getElementById('posts-empty').hidden = data.posts.length > 0;
  refreshReveals(); // the page below just moved
}

// Builds an element; all text goes in as plain text, never as HTML.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function longDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** A paragraph of post text, with any web addresses in it turned into links. */
function paragraph(text) {
  const p = el('p');
  let last = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/g)) {
    const url = match[0].replace(/[.,;:!?)\]]+$/, ''); // punctuation after a link is not part of it
    const link = el('a', '', url);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    p.append(text.slice(last, match.index), link);
    last = match.index + url.length;
  }
  p.append(text.slice(last));
  return p;
}

function postCard(post) {
  const card = el('article', 'card post');
  const body = el('div', 'post-body');
  body.append(...post.body.split(/\n{2,}/).map(paragraph));
  card.append(el('p', 'post-date', longDate(post.created_at)), el('h3', 'post-title', post.title), body, commentsBlock(post));
  return card;
}

function commentsBlock(post) {
  const block = el('div', 'post-comments');

  if (!getGuest()) {
    const locked = el('p', 'comment-locked');
    const rsvp = el('a', '', 'RSVP');
    rsvp.href = '#rsvp';
    const signIn = el('a', '', 'sign in');
    signIn.href = '#guestbook';
    locked.append(rsvp, ' or ', signIn, ' to read and leave comments.');
    block.append(locked);
    return block;
  }

  const count = post.comments.length;
  block.append(el('p', 'comments-title', count === 0 ? 'No comments yet' : count === 1 ? '1 comment' : `${count} comments`));
  block.append(...post.comments.map(commentCard), commentForm(post));
  return block;
}

function commentCard(comment) {
  const card = el('div', 'comment');
  const meta = el('p', 'note-meta');
  meta.append(el('span', 'note-name', comment.name), ` · ${longDate(comment.created_at)}`);
  card.append(el('p', 'comment-message', comment.message), meta);
  return card;
}

function pendingText(count) {
  return count === 1
    ? 'Your comment is waiting for Shafi and Phoenix to read it. It will appear here soon.'
    : `Your ${count} comments are waiting for Shafi and Phoenix to read them. They will appear here soon.`;
}

function commentForm(post) {
  const form = el('form', 'comment-form');
  form.noValidate = true;

  const field = el('div', 'field');
  const label = el('label', '', 'Leave a comment');
  const message = el('textarea');
  message.id = `comment-message-${post.id}`;
  message.name = 'message';
  message.rows = 3;
  message.maxLength = MAX_LENGTH;
  message.required = true;
  label.htmlFor = message.id;
  field.append(label, message);

  const status = el('p', 'form-status');
  status.setAttribute('role', 'alert');
  status.hidden = true;

  const button = el('button', 'btn btn-small', 'Post comment');
  button.type = 'submit';

  const pendingLine = el('p', 'pending-line');
  pendingLine.hidden = post.pending === 0;
  if (post.pending > 0) pendingLine.textContent = pendingText(post.pending);

  form.append(field, status, button, pendingLine);

  onSubmit(form, async (data) => {
    if (!data.get('message').trim()) throw fieldError('Please write a comment first.', 'message');
    await api('/api/comments', { postId: post.id, message: data.get('message') });
    form.reset();
    pendingLine.textContent = 'Thank you! Your comment is on its way to Shafi and Phoenix, and it will appear here soon.';
    pendingLine.hidden = false;
  });
  return form;
}
