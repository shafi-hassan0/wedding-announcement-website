// Contact section: the "send them a message" form.

import { api } from '../../shared/api.js';
import { fieldError, onSubmit, showPanel } from '../../shared/forms.js';

export function initContact() {
  const form = document.getElementById('contact-form');
  const done = document.getElementById('contact-done');

  onSubmit(form, async (data) => {
    if (!data.get('name').trim()) throw fieldError('Please enter your name.', 'name');
    if (!data.get('reply').trim()) throw fieldError('Please enter a phone number or email so they can reply.', 'reply');
    if (!data.get('message').trim()) throw fieldError('Please write a message first.', 'message');

    await api('/api/contact', {
      name: data.get('name'),
      reply: data.get('reply'),
      message: data.get('message'),
      website: data.get('website'), // honeypot; real guests never fill this in
    });

    form.hidden = true;
    showPanel(done);
  });
}
