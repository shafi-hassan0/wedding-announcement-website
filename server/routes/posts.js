// Updates ("the blog"): short posts written by Shafi and Phoenix on the admin page.
// Anyone with the link can read them. Comments work like the guestbook: only guests
// with an RSVP can read or write them, and a comment stays hidden until it is approved.

import { config } from '../config.js';
import { all, get, run } from '../db.js';
import { notify } from '../lib/email.js';
import { HttpError, json, readBody, siteOrigin } from '../lib/http.js';
import { currentGuest, requireAdmin } from '../lib/session.js';
import { text } from '../lib/validate.js';

const MAX_COMMENT = 500;

/**
 * GET /api/posts — every update, newest first. A recognised guest also gets each
 * update's approved comments and how many of their own are still waiting.
 */
export function listPosts(req) {
  const guest = currentGuest(req);
  const posts = all('SELECT id, title, body, created_at FROM posts ORDER BY created_at DESC LIMIT 100')
    .map((post) => ({ ...post, comments: [], pending: 0 }));
  if (!guest) return json({ posts });

  const byId = new Map(posts.map((post) => [post.id, post]));
  const comments = all("SELECT id, post_id, name, message, created_at FROM comments WHERE status = 'approved' ORDER BY created_at LIMIT 2000");
  for (const { post_id: postId, ...comment } of comments) byId.get(postId)?.comments.push(comment);

  const waiting = all("SELECT post_id, COUNT(*) AS n FROM comments WHERE rsvp_id = ? AND status = 'pending' GROUP BY post_id", guest.id);
  for (const row of waiting) {
    const post = byId.get(row.post_id);
    if (post) post.pending = row.n;
  }
  return json({ posts });
}

/** POST /api/comments — { postId, message }. Leaves a comment, held for approval. */
export async function addComment(req) {
  const guest = currentGuest(req);
  if (!guest) throw new HttpError(401, 'Please RSVP first, then come back to leave a comment.');

  const body = await readBody(req);
  const post = get('SELECT id, title FROM posts WHERE id = ?', Number(body.postId) || 0);
  if (!post) throw new HttpError(404, 'That update is no longer here.');

  const message = text(body.message, MAX_COMMENT, true);
  if (!message) throw new HttpError(400, 'Please write a comment first.', 'message');
  if (String(body.message || '').trim().length > MAX_COMMENT) {
    throw new HttpError(400, `Please keep your comment under ${MAX_COMMENT} characters.`, 'message');
  }

  const count = get('SELECT COUNT(*) AS n FROM comments WHERE rsvp_id = ? AND post_id = ?', guest.id, post.id);
  if (count.n >= config.maxCommentsPerPost) {
    throw new HttpError(429, `You have already left ${config.maxCommentsPerPost} comments here. Thank you for all the love!`, 'message');
  }

  run("INSERT INTO comments (post_id, rsvp_id, name, message, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)",
    post.id, guest.id, guest.name, message, new Date().toISOString());

  notify(`New comment from ${guest.name} (needs approval)`,
    `${guest.name} commented on "${post.title}":\n\n${message}\n\nIt will not appear on the site until one of you approves it:\n${siteOrigin(req)}/admin`,
    { fromName: guest.name });
  return json({ ok: true });
}

/* ---------- admin ---------- */

function readPost(body) {
  const post = { title: text(body.title, 120), body: text(body.body, 5000, true) };
  if (!post.title) throw new HttpError(400, 'Please give the update a title.', 'title');
  if (!post.body) throw new HttpError(400, 'Please write the update first.', 'body');
  return post;
}

/** POST /api/admin/posts — publish a new update. */
export async function addPost(req) {
  requireAdmin(req);
  const post = readPost(await readBody(req));
  const now = new Date().toISOString();
  run('INSERT INTO posts (title, body, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)', post.title, post.body, now);
  return json({ ok: true });
}

/** POST /api/admin/posts/:id — { action: "update", title, body } or { action: "delete" }. */
export async function changePost(req, id) {
  requireAdmin(req);
  const body = await readBody(req);

  if (body.action === 'delete') {
    const result = run('DELETE FROM posts WHERE id = ?', id); // its comments go with it
    if (result.changes === 0) throw new HttpError(404, 'That update is already gone.');
    return json({ ok: true });
  }

  if (body.action === 'update') {
    const post = readPost(body);
    const result = run('UPDATE posts SET title = ?, body = ?, updated_at = ? WHERE id = ?',
      post.title, post.body, new Date().toISOString(), id);
    if (result.changes === 0) throw new HttpError(404, 'That update no longer exists.');
    return json({ ok: true });
  }

  throw new HttpError(400, 'Unknown action.');
}

/** POST /api/admin/comments/:id — approve a comment, take it back off the site, or delete it. */
export async function moderateComment(req, id) {
  requireAdmin(req);
  const body = await readBody(req);
  if (body.action === 'approve') run("UPDATE comments SET status = 'approved' WHERE id = ?", id);
  else if (body.action === 'hide') run("UPDATE comments SET status = 'pending' WHERE id = ?", id);
  else if (body.action === 'delete') run('DELETE FROM comments WHERE id = ?', id);
  else throw new HttpError(400, 'Unknown action.');
  return json({ ok: true });
}
