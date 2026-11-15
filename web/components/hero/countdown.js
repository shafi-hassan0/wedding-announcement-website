// The countdown in the hero: days, hours, minutes and seconds until the party.
// While the party is on it says so instead, and once it is over it hides itself.
// The start and end times are on the element (data-start / data-end in hero.html).

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const LABELS = {
  days: ['Day', 'Days'],
  hours: ['Hour', 'Hours'],
  minutes: ['Minute', 'Minutes'],
  seconds: ['Second', 'Seconds'],
};

export function initCountdown() {
  const box = document.getElementById('countdown');
  if (!box) return;

  const start = new Date(box.dataset.start).getTime();
  const end = new Date(box.dataset.end).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return;

  const units = box.querySelector('.countdown-units');
  const caption = box.querySelector('.countdown-caption');
  const now = box.querySelector('.countdown-now');
  const value = (unit) => box.querySelector(`[data-unit="${unit}"]`);
  const label = (unit) => box.querySelector(`[data-label="${unit}"]`);

  let timer;
  const tick = () => {
    const left = start - Date.now();

    if (Date.now() >= end) {
      box.hidden = true;
      clearTimeout(timer);
      return;
    }

    const partyOn = left <= 0;
    units.hidden = partyOn;
    caption.hidden = partyOn;
    now.hidden = !partyOn;
    box.hidden = false;

    if (!partyOn) {
      const parts = {
        days: Math.floor(left / DAY),
        hours: Math.floor((left % DAY) / HOUR),
        minutes: Math.floor((left % HOUR) / MINUTE),
        seconds: Math.floor((left % MINUTE) / SECOND),
      };
      for (const [unit, n] of Object.entries(parts)) {
        value(unit).textContent = unit === 'days' ? String(n) : String(n).padStart(2, '0');
        label(unit).textContent = LABELS[unit][n === 1 ? 0 : 1];
      }
    }

    // Wake up just after the next whole second, so the seconds tick evenly.
    timer = setTimeout(tick, SECOND - (Date.now() % SECOND) + 20);
  };

  tick();
}
