// Adds a layer of slowly rising hearts behind the hero and every section.
// The look (colors, the float-up animation) is in hearts.css.

import { reducedMotion } from './motion.js';

const PIXELS_PER_SECOND = 38; // how fast a heart rises, so tall and short sections feel the same
const SECTION_HEIGHT_PER_HEART = 110; // one heart for roughly every 110px of section height

const random = (min, max) => min + Math.random() * (max - min);

function heartLayer(section) {
  const height = section.offsetHeight;
  const count = Math.round(Math.min(Math.max(height / SECTION_HEIGHT_PER_HEART, 8), 30));

  const layer = document.createElement('div');
  layer.className = 'hearts';
  layer.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < count; i++) {
    const heart = document.createElement('span');
    heart.textContent = '♥';
    const duration = (height + 110) / (PIXELS_PER_SECOND * random(0.75, 1.3));
    // Spread the hearts evenly across the width, with a little wobble.
    heart.style.setProperty('--left', `${((i + random(0.15, 0.85)) / count) * 100}%`);
    heart.style.setProperty('--size', `${random(0.95, 2.1).toFixed(2)}rem`);
    heart.style.setProperty('--duration', `${duration.toFixed(1)}s`);
    // A negative delay starts each heart partway up, so the section is already full of them.
    heart.style.setProperty('--delay', `${(-random(0, duration)).toFixed(1)}s`);
    layer.append(heart);
  }
  return layer;
}

export function initHearts() {
  if (reducedMotion) return;

  // Only animate the sections that are on screen.
  const onScreen = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        for (const entry of entries) entry.target.classList.toggle('is-paused', !entry.isIntersecting);
      })
    : null;

  document.querySelectorAll('.hero, .section').forEach((section) => {
    const layer = heartLayer(section);
    section.prepend(layer);
    onScreen?.observe(layer);
  });
}
