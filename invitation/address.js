// Name-and-address form fields (used by both the guest form and the return address
// form), and helpers for turning an address into the lines printed on a label.

const FIELDS = ['name', 'line1', 'line2', 'city', 'state', 'zip', 'country'];
const template = document.getElementById('address-fields-template');

// The country every address is in unless it says otherwise. The envelopes are mailed
// from here, so this country is never printed on a label; any other country is.
export const HOME_COUNTRY = 'United States';
const HOME_COUNTRY_NAMES = ['unitedstates', 'unitedstatesofamerica', 'usa', 'us', 'america'];

/** Is this address outside the United States? An empty country means it is not. */
export function isAbroad(address) {
  const country = (address.country || '').toLowerCase().replace(/[^a-z]/g, '');
  return Boolean(country) && !HOME_COUNTRY_NAMES.includes(country);
}

/** The value shown in a form's country box: the saved country, or the United States. */
const countryOrHome = (address) => address?.country || HOME_COUNTRY;

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

  const set = (address) => {
    FIELDS.forEach((field) => { inputs[field].value = address?.[field] || ''; });
    inputs.country.value = countryOrHome(address);
  };
  set(null);

  return {
    get: () => Object.fromEntries(FIELDS.map((field) => [field, inputs[field].value.trim()])),
    set,
    clear: () => set(null),
    focus: () => inputs.name.focus(),
  };
}

/** "Glen Allen, VA 23060" */
function cityLine(address) {
  const stateZip = [address.state, address.zip].filter(Boolean).join(' ');
  return [address.city, stateZip].filter(Boolean).join(', ');
}

/**
 * The address lines under the name on a label, skipping any that are empty. An address
 * outside the United States ends with its country in capitals, as the post office asks.
 */
export function addressLines(address) {
  const country = isAbroad(address) ? address.country.toUpperCase() : '';
  return [address.line1, address.line2, cityLine(address), country].filter(Boolean);
}

/** Does this guest have enough of an address to print a delivery label? */
export function hasAddress(address) {
  return Boolean(address.line1);
}

/** A street address without a city, state or ZIP. Printed, but flagged in the guest list. */
export function isIncomplete(address) {
  return hasAddress(address) && !(address.city && address.state && address.zip);
}
