/**
 * AUM Enterprise — landing page behaviour
 * Nav, mobile drawer, scroll reveals, parallax, counters,
 * WhatsApp deep links and the enquiry form.
 */

const PHONE = '8275613310';           // shop number, without country code
const CC = '91';
const BRAND = 'AUM Enterprise';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/* ── phone numbers ───────────────────────────────────────── */
function applyPhone() {
  const pretty = `+${CC} ${PHONE.slice(0, 5)} ${PHONE.slice(5)}`;
  $$('.phone-link').forEach(el => {
    el.href = `tel:+${CC}${PHONE}`;
    if (el.children.length === 0) el.textContent = pretty;
  });
  $$('.phone-display').forEach(el => { el.textContent = pretty; });
}

/* ── WhatsApp ────────────────────────────────────────────── */
function waUrl(text) {
  return `https://wa.me/${CC}${PHONE}?text=${encodeURIComponent(text)}`;
}

function setupWhatsApp() {
  const intro = `Hello ${BRAND}, I'd like to know more about your welding and power tool range.`;
  $$('.wa-link').forEach(el => {
    el.href = waUrl(intro);
    el.target = '_blank';
    el.rel = 'noopener';
  });
}

/* ── sticky nav + active section ─────────────────────────── */
function setupNav() {
  const nav = $('#nav');
  const fab = $('.wa-fab');
  const links = $$('.nav__links a');
  const sections = links
    .map(a => $(a.getAttribute('href')))
    .filter(Boolean);

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      nav.classList.toggle('is-stuck', y > 24);
      if (fab) fab.classList.toggle('is-on', y > window.innerHeight * 0.6);

      let active = null;
      const line = y + window.innerHeight * 0.32;
      sections.forEach(s => { if (s.offsetTop <= line) active = s.id; });
      links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === `#${active}`));

      ticking = false;
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ── mobile drawer ───────────────────────────────────────── */
function setupDrawer() {
  const burger = $('#burger');
  const drawer = $('#drawer');
  if (!burger || !drawer) return;

  const close = () => {
    burger.setAttribute('aria-expanded', 'false');
    drawer.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { if (!drawer.classList.contains('is-open')) drawer.hidden = true; }, 350);
  };

  const open = () => {
    drawer.hidden = false;
    requestAnimationFrame(() => drawer.classList.add('is-open'));
    burger.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };

  burger.addEventListener('click', () => {
    burger.getAttribute('aria-expanded') === 'true' ? close() : open();
  });
  $$('a', drawer).forEach(a => a.addEventListener('click', close));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  window.addEventListener('resize', () => { if (window.innerWidth > 860) close(); });
}

/* ── scroll reveal ───────────────────────────────────────── */
function setupReveal() {
  const items = $$('.reveal');
  items.forEach(el => {
    const d = el.dataset.delay;
    if (d) el.style.setProperty('--d', d);
  });

  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  items.forEach(el => io.observe(el));
}

/* ── parallax ────────────────────────────────────────────── */
function setupParallax() {
  const layers = $$('[data-parallax]');
  if (reduceMotion || !layers.length) return;

  let ticking = false;
  const update = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const vh = window.innerHeight;
      layers.forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) return;
        const rate = parseFloat(el.dataset.parallax) || 0.2;
        const offset = (rect.top + rect.height / 2 - vh / 2) * rate;
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      });
      ticking = false;
    });
  };

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

/* ── stat counters ───────────────────────────────────────── */
function setupCounters() {
  const nums = $$('[data-count]');
  if (!nums.length) return;

  const run = el => {
    const target = parseInt(el.dataset.count, 10);
    const suffix = el.dataset.suffix || '';
    if (reduceMotion || Number.isNaN(target)) { el.textContent = target + suffix; return; }

    const dur = 1100;
    const start = performance.now();
    const tick = now => {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  if (!('IntersectionObserver' in window)) { nums.forEach(run); return; }

  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      run(e.target);
      obs.unobserve(e.target);
    });
  }, { threshold: 0.6 });

  nums.forEach(el => io.observe(el));
}

/* ── enquiry form → WhatsApp ─────────────────────────────── */
function setupForm() {
  const form = $('#contactForm');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();

    let firstBad = null;
    $$('.field', form).forEach(field => {
      const input = $('input, select, textarea', field);
      const ok = input.checkValidity();
      field.classList.toggle('is-bad', !ok);
      if (!ok && !firstBad) firstBad = input;
    });

    if (firstBad) {
      toast('Please fill in the highlighted fields.', 'warn');
      firstBad.focus();
      return;
    }

    const d = Object.fromEntries(new FormData(form));
    const text =
      `*New enquiry — ${BRAND} website*\n\n` +
      `*Name:* ${d.name}\n` +
      `*Phone:* ${d.phone}\n` +
      `*Subject:* ${d.subject}\n` +
      `*Details:* ${d.message}`;

    toast('Opening WhatsApp…');
    window.open(waUrl(text), '_blank', 'noopener');
    form.reset();
  });

  $$('.field input, .field select, .field textarea', form).forEach(el => {
    el.addEventListener('input', () => el.closest('.field').classList.remove('is-bad'));
  });
}

/* ── toast ───────────────────────────────────────────────── */
let toastTimer;
function toast(message, kind = 'ok') {
  document.querySelector('.toast')?.remove();
  clearTimeout(toastTimer);

  const el = document.createElement('div');
  el.className = `toast${kind === 'warn' ? ' toast--warn' : ''}`;
  el.setAttribute('role', 'status');
  el.innerHTML =
    `<svg class="ico"><use href="#${kind === 'warn' ? 'i-warn' : 'i-check-c'}"/></svg><span></span>`;
  el.querySelector('span').textContent = message;

  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-on'));

  toastTimer = setTimeout(() => {
    el.classList.remove('is-on');
    setTimeout(() => el.remove(), 400);
  }, 3200);
}

/* ── boot ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  applyPhone();
  setupWhatsApp();
  setupNav();
  setupDrawer();
  setupReveal();
  setupParallax();
  setupCounters();
  setupForm();
});
