// Shared behaviour for the page's forms: submitting, showing errors, and
// swapping a form for its "done" panel.

/** An error to show the guest, tied to the form field it is about. */
export function fieldError(message, field) {
  return Object.assign(new Error(message), { field });
}

function clearErrors(form) {
  form.querySelectorAll('.has-error').forEach((el) => el.classList.remove('has-error'));
  const status = form.querySelector('.form-status');
  status.hidden = true;
  status.textContent = '';
}

function showError(form, message, fieldName) {
  const status = form.querySelector('.form-status');
  status.textContent = message;
  status.hidden = false;
  if (!fieldName) return;

  const input = form.elements[fieldName];
  const target = input instanceof RadioNodeList ? input[0] : input;
  if (!target) return;
  const field = target.closest('.field');
  field?.classList.add('has-error');
  target.focus({ preventScroll: true });
  field?.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

/**
 * Runs `handler(formData)` when the form is submitted. While it runs the button is
 * disabled, so a double tap cannot send twice. If the handler throws, the message
 * is shown in the form and the field named by `error.field` is highlighted.
 */
export function onSubmit(form, handler) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const label = button.textContent;
    clearErrors(form);
    button.disabled = true;
    button.textContent = 'Sending…';
    try {
      await handler(new FormData(form));
    } catch (err) {
      showError(form, err.message, err.field);
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  });
}

/** Shows a hidden panel, scrolls it into view, and moves focus to it for screen readers. */
export function showPanel(panel) {
  panel.hidden = false;
  panel.focus({ preventScroll: true });
  panel.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
