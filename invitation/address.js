// Name-and-address form fields (used by both the guest form and the return address
// form), and helpers for turning an address into the lines printed on a label.

const FIELDS = ['name', 'line1', 'line2', 'city', 'state', 'zip'];
const template = document.getElementById('address-fields-template');

/**
 * Fills a form's [data-address-fields] placeholder with name and address inputs.
 * Returns controls for reading and writing them.
 */
export function addressFields(form) {
  const slot = form.querySelector('[data-address-fields]');
  const prefix = slot.dataset.addressFields;
  slot.append(template.content.cloneNode(true));
  slot.querySelector('[data-for="name"]').textContent = slot.dataset.nameLabel;

  const inputs = {};
  for (const field of FIELDS) {
    const input = slot.querySelector(`[data-field="${field}"]`);
    input.id = `${prefix}-${field}`;
    input.name = field;
    slot.querySelector(`[data-for="${field}"]`).htmlFor = input.id;
    inputs[field] = input;
  }

  return {
    get: () => Object.fromEntries(FIELDS.map((field) => [field, inputs[field].value.trim()])),
    set: (address) => FIELDS.forEach((field) => { inputs[field].value = address?.[field] || ''; }),
    clear: () => FIELDS.forEach((field) => { inputs[field].value = ''; }),
    focus: () => inputs.name.focus(),
  };
}

/** "Glen Allen, VA 23060" */
function cityLine(address) {
  const stateZip = [address.state, address.zip].filter(Boolean).join(' ');
  return [address.city, stateZip].filter(Boolean).join(', ');
}

/** The address lines under the name on a label, skipping any that are empty. */
export function addressLines(address) {
  return [address.line1, address.line2, cityLine(address)].filter(Boolean);
}

/** Does this guest have enough of an address to print a delivery label? */
export function hasAddress(address) {
  return Boolean(address.line1);
}

/** A street address without a city, state or ZIP. Printed, but flagged in the guest list. */
export function isIncomplete(address) {
  return hasAddress(address) && !(address.city && address.state && address.zip);
}
