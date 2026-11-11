// Who is using the page: the guest who RSVP'd on this device, or null.
// Sections subscribe with onGuestChange so they can update when someone
// RSVPs, signs in, or turns out not to be signed in after all.

let guest = null;
const listeners = [];

/** The current guest ({ name, firstName, attending }) or null. */
export function getGuest() {
  return guest;
}

/** Sets the current guest and tells every subscribed section. */
export function setGuest(next) {
  guest = next;
  for (const listener of listeners) listener(guest);
}

/** Calls `listener(guest)` every time the guest changes. */
export function onGuestChange(listener) {
  listeners.push(listener);
}
