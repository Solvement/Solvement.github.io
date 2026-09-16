import { geoOrthographic, geoPath, geoGraticule10, geoDistance } from 'd3-geo';
import { feature } from 'topojson-client';
import { readingGraph } from './graph.js';
import { renderNotes } from './notes.js';
import { cinematicIntro } from './cinematic.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const root = document.documentElement;

/* Cinematic title; hash navigation and reduced motion bypass it. */
const curtain = document.querySelector('.intro-curtain');
const introTimers = [];
let stopIntro = () => {};
function skipKey(e) { if (e.key === 'Escape' || e.key === 'Tab') finishIntro(); }
function finishIntro() {
  stopIntro(); introTimers.forEach(clearTimeout);
  document.removeEventListener('keydown', skipKey);
  root.classList.remove('intro-running');
  root.style.setProperty('--intro-delay', '0s');
  curtain?.remove();
}
if (curtain && !reduced.matches && !location.hash && scrollY < 20) {
  root.classList.add('intro-running');
  stopIntro = cinematicIntro(curtain);
  introTimers.push(setTimeout(() => curtain.classList.add('leaving'), 5700));
  introTimers.push(setTimeout(finishIntro, 6500));
  curtain.addEventListener('click', finishIntro);
  document.addEventListener('keydown', skipKey);
} else curtain?.remove();
window.addEventListener('pagehide', finishIntro);

/* ── Motion switch ── */
let paused = reduced.matches;
let syncGraphMotion = () => {};
const pauseButton = document.querySelector('.motion-switch');
function syncPause() {
  pauseButton.textContent = paused ? 'Play motion' : 'Pause motion';
  pauseButton.setAttribute('aria-pressed', String(paused));
  root.classList.toggle('motion-paused', paused);
  syncGraphMotion();
}
root.classList.add('motion-ready');
syncPause();

/* ── Places ── */
const places = [
  { id: 'hongkong', name: 'Hong Kong', ll: [114.17, 22.32], offset: [0, 18] },
  { id: 'shenzhen', name: 'Shenzhen', ll: [114.06, 22.55], offset: [0, -14] },
  { id: 'shanghai', name: 'Shanghai', ll: [121.47, 31.23] },
  { id: 'newyork', name: 'New York', ll: [-74.01, 40.71] },
  { id: 'novi', name: 'Novi, Michigan', ll: [-83.48, 42.48] },
];
const facts = {
  hongkong: [['Education', 'The Chinese University of Hong Kong', 'B.Eng. Computer Engineering', 'Sep 2021 – Jun 2025']],
  shenzhen: [['Intern', 'VisionNav Robotics', 'AI Algorithm Engineer Intern', 'Jul 2023 – Aug 2023']],
  shanghai: [['Intern', 'NIO', 'Machine Learning Engineer Intern', 'May 2024 – Jul 2024'], ['Intern', 'Capgemini', 'Backend Software Engineer Intern', 'Aug 2024 – Sep 2024']],
  newyork: [['Education', 'New York University', 'M.S. Computer Engineering', 'Sep 2025 – May 2027'], ['Research', 'New York University', 'Research Assistant · RoboRefer / ESCA', '']],
  novi: [['Intern', 'Yanfeng Automotive Interiors', 'Software Engineer Intern', 'May 2026 – Aug 2026']],
};

const globe = document.querySelector('#experience-globe');
const field = document.querySelector('.opening-field');
const gc = globe.getContext('2d');
const fc = field.getContext('2d');
const status = document.querySelector('#globe-status');
const entries = [...document.querySelectorAll('#experience-list .entry[data-place]')];

/* Tooltip on globe labels */
const tip = document.createElement('div'); tip.className = 'geo-tooltip'; tip.id = 'geo-tooltip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true; document.body.append(tip);
function hideTip() { tip.hidden = true; }
function showTip(id, x, y) {
  const place = places.find((p) => p.id === id); tip.replaceChildren();
  const title = document.createElement('h3'); title.textContent = place.name; tip.append(title);
  let group = ''; let list;
  for (const [category, company, role, date] of facts[id]) {
    if (group !== category) { const h = document.createElement('h4'); h.textContent = category; tip.append(h); list = document.createElement('ol'); tip.append(list); group = category; }
    const item = document.createElement('li'); const b = document.createElement('strong'); b.textContent = company;
    const r = document.createElement('span'); r.textContent = role; const time = document.createElement('time'); time.textContent = date; item.append(b, r, time); list.append(item);
  }
  tip.hidden = false;
  tip.style.left = Math.max(8, Math.min(innerWidth - tip.offsetWidth - 8, x + 18)) + 'px';
  tip.style.top = Math.max(8, Math.min(innerHeight - tip.offsetHeight - 8, y + 18)) + 'px';
}
window.addEventListener('scroll', hideTip, { passive: true });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.globe-label')) hideTip(); });

const markerLayer = document.createElement('div'); markerLayer.className = 'globe-labels'; globe.parentElement.append(markerLayer);
const labelOffsets = { hongkong: [-104, 22], shenzhen: [20, -24], shanghai: [20, -42], newyork: [22, 14], novi: [-132, -26] };
const labelButtons = new Map(places.map((place) => {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'globe-label';
  button.textContent = place.name; button.dataset.geoPlace = place.id; button.hidden = true;
  button.setAttribute('aria-describedby', 'geo-tooltip');
  button.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') showTip(place.id, e.clientX, e.clientY); });
  button.addEventListener('pointerleave', hideTip);
  button.addEventListener('focus', () => { const r = button.getBoundingClientRect(); showTip(place.id, r.right, r.bottom); });
  button.addEventListener('blur', hideTip);
  button.addEventListener('click', (e) => { choose(place.id); showTip(place.id, e.clientX, e.clientY); });
  markerLayer.append(button); return [place.id, button];
}));

let rotation = [74, -26, 0];
let target = null;
let selected = 'newyork';
let autoRotate = !paused;
let pointerOnGlobe = false;
globe.parentElement.addEventListener('pointerenter', () => { pointerOnGlobe = true; });
globe.parentElement.addEventListener('pointerleave', () => { pointerOnGlobe = false; hideTip(); });
let land = null;
let frame = 0, last = 0, clock = 0, lastField = -100;
let fieldVisible = true, globeVisible = false;
let gw = 0, gh = 0, fw = 0, fh = 0;
let markers = [];
let letterMask = null;
let drag = null;
const projection = geoOrthographic().clipAngle(90).precision(.5);
const graticule = geoGraticule10();
const path = gc ? geoPath(projection, gc) : null;

function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const gb = globe.getBoundingClientRect();
  const fb = field.getBoundingClientRect();
  gw = gb.width; gh = gb.height; fw = fb.width; fh = fb.height;
  for (const [canvas, ctx, w, h] of [[globe, gc, gw, gh], [field, fc, fw, fh]]) {
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  projection.translate([gw / 2, gh / 2 - 8]).scale(Math.min(gw, gh) * .435);
  // Character field is masked to the word KEVIN, drawn behind the five words at the foot of the hero.
  const mask = document.createElement('canvas'); mask.width = Math.ceil(fw); mask.height = Math.ceil(fh);
  const mc = mask.getContext('2d');
  const wb = document.querySelector('.opening-words')?.getBoundingClientRect();
  if (mc && fw && fh && wb) {
    mc.textAlign = 'center'; mc.textBaseline = 'middle';
    // Use each real grid cell, not a guessed row height or breakpoint.
    document.querySelectorAll('.opening-word').forEach((word, i) => {
      const box = word.getBoundingClientRect();
      const size = Math.min(box.width * .85, box.height * 1.15);
      mc.font = `900 ${size}px Arial, sans-serif`;
      mc.fillText('KEVIN'[i], box.left - fb.left + box.width / 2, box.top - fb.top + box.height / 2);
    });
    letterMask = mc.getImageData(0, 0, mask.width, mask.height);
  }
  drawGlobe(); drawField();
}

function drawGlobe() {
  if (!gc || !gw) return;
  gc.clearRect(0, 0, gw, gh);
  projection.rotate(rotation);
  const cx = gw / 2, cy = gh / 2 - 8, r = projection.scale();
  const gradient = gc.createRadialGradient(cx - r * .35, cy - r * .4, r * .05, cx, cy, r);
  gradient.addColorStop(0, '#fcfcfa'); gradient.addColorStop(.75, '#f2f3ee'); gradient.addColorStop(1, '#e5e7e1');
  gc.beginPath(); path({ type: 'Sphere' }); gc.fillStyle = gradient; gc.fill();
  gc.strokeStyle = '#8a9c9a'; gc.lineWidth = .7; gc.stroke();
  gc.beginPath(); path(graticule); gc.strokeStyle = 'rgba(35,81,101,.16)'; gc.lineWidth = .6; gc.stroke();
  if (land) { gc.beginPath(); path(land); gc.fillStyle = '#d5d8d1'; gc.fill(); gc.strokeStyle = '#929b94'; gc.lineWidth = .65; gc.stroke(); }
  gc.beginPath(); gc.ellipse(cx, cy, r * 1.05, r * 1.05, 0, 0, Math.PI * 2); gc.strokeStyle = 'rgba(35,81,101,.12)'; gc.lineWidth = .6; gc.stroke();
  const front = [-rotation[0], -rotation[1]];
  markers = [];
  for (const place of places) {
    const button = labelButtons.get(place.id);
    if (geoDistance(front, place.ll) >= Math.PI / 2 - .035) { button.hidden = true; continue; }
    button.hidden = false;
    const [x, y] = projection(place.ll);
    const [ox, oy] = place.offset || [0, 0];
    const mx = x + ox, my = y + oy;
    const active = place.id === selected;
    markers.push({ place, x: mx, y: my });
    if (ox || oy) { gc.beginPath(); gc.moveTo(x, y); gc.lineTo(mx, my); gc.strokeStyle = '#235165'; gc.lineWidth = 1; gc.stroke(); }
    if (active) { gc.beginPath(); gc.arc(mx, my, 13 + (paused ? 0 : Math.sin(clock * .002) * 2), 0, Math.PI * 2); gc.strokeStyle = 'rgba(35,81,101,.3)'; gc.lineWidth = 1; gc.stroke(); }
    gc.beginPath(); gc.arc(mx, my, active ? 5 : 3.5, 0, Math.PI * 2); gc.fillStyle = '#235165'; gc.fill(); gc.strokeStyle = '#f6f4ed'; gc.lineWidth = 2; gc.stroke();
    const [lx, ly] = labelOffsets[place.id];
    const tx = Math.max(3, Math.min(gw - button.offsetWidth - 3, mx + lx));
    const ty = Math.max(3, Math.min(gh - 30, my + ly));
    button.style.transform = `translate(${tx}px,${ty}px)`;
    button.setAttribute('aria-pressed', String(active));
    gc.beginPath(); gc.moveTo(mx, my); gc.lineTo(tx + button.offsetWidth / 2, ty + 12);
    gc.strokeStyle = 'rgba(35,81,101,.45)'; gc.lineWidth = .7; gc.stroke();
  }
}

function drawField() {
  if (!fc || !fw) return;
  fc.clearRect(0, 0, fw, fh);
  const step = fw < 600 ? 13 : 16;
  const t = clock * .0003;
  const letters = 'knowledge evaluation vision infrastructure neural kevin ';
  fc.font = '10px monospace';
  if (letterMask) {
    for (let y = 0; y < fh; y += step) {
      for (let x = 0; x < fw; x += 7) {
        const inside = letterMask.data[(Math.floor(y) * letterMask.width + Math.floor(x)) * 4 + 3] > 40;
        if (!inside) continue;
        const wave = (Math.sin(x * .008 + t + y * .012) + 1) / 2;
        fc.fillStyle = `rgba(35,55,63,${.22 + wave * .3})`;
        const index = (Math.floor(x / 7) + Math.floor(y / step) * 3 + Math.floor(clock / 220)) % letters.length;
        fc.fillText(letters[index], x, y);
      }
    }
  }
  // A sparse signal network drifts across the upper hero.
  for (let i = 0; i < 7; i++) {
    const y = fh * (.12 + i * .075) + Math.sin(t + i) * 17;
    const x = ((clock * .025 + i * fw / 7) % (fw + 180)) - 90;
    fc.strokeStyle = 'rgba(35,81,101,.16)'; fc.lineWidth = .7;
    fc.beginPath(); fc.moveTo(x, y); fc.lineTo(x + 45, y); fc.lineTo(x + 68, y - 22); fc.lineTo(x + 105, y - 22); fc.stroke();
    fc.fillStyle = 'rgba(35,81,101,.45)'; fc.fillRect(x + 103, y - 24, 3, 3);
  }
}

function choose(id, rotate = true) {
  const place = places.find((p) => p.id === id); if (!place) return;
  selected = id; autoRotate = false;
  target = rotate ? [-place.ll[0], -place.ll[1], 0] : null;
  entries.forEach((el) => { const on = el.dataset.place === id; el.classList.toggle('active', on); el.setAttribute('aria-pressed', String(on)); });
  status.textContent = place.name;
  if (paused && target) { rotation = target; target = null; }
  drawGlobe(); start();
}
entries.forEach((el) => {
  el.addEventListener('click', (e) => { if (e.target.closest('a')) return; choose(el.dataset.place); });
  el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(el.dataset.place); } });
});

function tick(now) {
  frame = 0;
  if (document.hidden) return;
  const dt = Math.min(now - last || 16, 45); last = now;
  if (!paused) clock += dt;
  if (globeVisible) {
    if (target) {
      const dx = ((target[0] - rotation[0] + 540) % 360) - 180;
      const dy = target[1] - rotation[1];
      const ease = 1 - Math.exp(-dt / 160);
      rotation[0] += dx * ease; rotation[1] += dy * ease;
      if (Math.abs(dx) + Math.abs(dy) < .03) { rotation = target; target = null; }
    } else if (!paused && autoRotate && !drag && !pointerOnGlobe) rotation[0] += (dt * .0025);
    drawGlobe();
  }
  if (fieldVisible && !paused && clock - lastField > 65) { drawField(); lastField = clock; }
  if ((!paused && (fieldVisible || globeVisible)) || (target && globeVisible)) frame = requestAnimationFrame(tick);
}
function start() { if (!frame && !document.hidden) { last = performance.now(); frame = requestAnimationFrame(tick); } }
pauseButton.addEventListener('click', () => {
  paused = !paused; autoRotate = !paused;
  if (paused) finishIntro();
  if (paused && target) { rotation = target; target = null; }
  syncPause(); drawGlobe(); start();
});
reduced.addEventListener('change', () => {
  if (reduced.matches) finishIntro();
  paused = reduced.matches; autoRotate = !paused;
  if (paused && target) { rotation = target; target = null; drawGlobe(); }
  syncPause(); start();
});

globe.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, rx: rotation[0], ry: rotation[1], moved: false };
  target = null; autoRotate = false;
  if (e.pointerType === 'mouse') globe.setPointerCapture(e.pointerId);
});
globe.addEventListener('pointermove', (e) => {
  if (!drag) {
    if (e.pointerType === 'mouse') {
      const rect = globe.getBoundingClientRect();
      const near = markers.find((m) => Math.hypot(m.x - (e.clientX - rect.left), m.y - (e.clientY - rect.top)) < 14);
      if (near) showTip(near.place.id, e.clientX, e.clientY); else hideTip();
    }
    return;
  }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
  rotation = [drag.rx + dx * .35, Math.max(-75, Math.min(75, drag.ry - dy * .25)), 0]; drawGlobe();
});
globe.addEventListener('pointerup', (e) => {
  if (drag && !drag.moved) {
    const rect = globe.getBoundingClientRect(); const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const nearest = markers.slice().sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
    if (nearest && Math.hypot(nearest.x - x, nearest.y - y) < 16) choose(nearest.place.id);
  }
  drag = null;
});
globe.addEventListener('pointercancel', () => { drag = null; });
globe.addEventListener('lostpointercapture', () => { drag = null; });
globe.addEventListener('keydown', (e) => {
  const deltas = { ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] };
  if (!deltas[e.key]) return; e.preventDefault(); target = null; autoRotate = false;
  rotation[0] += deltas[e.key][0]; rotation[1] = Math.max(-75, Math.min(75, rotation[1] + deltas[e.key][1])); drawGlobe();
});

const observer = new IntersectionObserver((list) => {
  for (const entry of list) { if (entry.target === field) fieldVisible = entry.isIntersecting; else globeVisible = entry.isIntersecting; }
  start();
}); observer.observe(field); observer.observe(globe);
const resizer = new ResizeObserver(resize); resizer.observe(field.parentElement); resizer.observe(globe.parentElement);
document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else start(); });
window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); frame = 0; });
window.addEventListener('pageshow', () => start());
resize(); start();
document.fonts.ready.then(resize);
choose('newyork', false);
autoRotate = !paused;
fetch('assets/land-110m.json').then((r) => { if (!r.ok) throw new Error('Map unavailable'); return r.json(); }).then((data) => {
  land = feature(data, data.objects.land); drawGlobe();
}).catch(() => { status.textContent = 'Map unavailable · select an entry'; });

/* ── Scroll reveal + nav spy ── */
const revealIO = new IntersectionObserver((list) => {
  for (const e of list) if (e.isIntersecting) { e.target.classList.add('in'); revealIO.unobserve(e.target); }
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
document.querySelectorAll('.reveal').forEach((el) => revealIO.observe(el));
const navLinks = [...document.querySelectorAll('.topnav a[href^="#"]')];
const spyTargets = navLinks.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
const spyIO = new IntersectionObserver((list) => {
  for (const e of list) if (e.isIntersecting) navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
}, { rootMargin: '-40% 0px -55% 0px' });
spyTargets.forEach((t) => spyIO.observe(t));

/* ── Copy handle ── */
document.querySelectorAll('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const v = btn.getAttribute('data-copy'); const old = btn.textContent;
    try { await navigator.clipboard.writeText(v); btn.textContent = 'Copied'; } catch { btn.textContent = v; }
    setTimeout(() => { btn.textContent = old; }, 1600);
  });
});

/* ── Data-driven sections ── */
fetch('assets/graph.json').then((r) => r.json()).then((graph) => {
  const s = graph.stats;
  const fmt = (n) => n.toLocaleString('en-US');
  const set = (sel, v) => document.querySelectorAll(sel).forEach((el) => { el.textContent = v; });
  const lastDay = s.perDay.at(-1);
  set('[data-jarvis="funnel"]', `${lastDay.collected} → ${lastDay.filtered} → ${lastDay.selected}`);
  set('[data-jarvis="days"]', `${s.days} days`);
  set('[data-jarvis="unique"]', fmt(s.unique));
  set('[data-jarvis="last"]', s.last);
  set('[data-stat="days"]', s.days);
  set('[data-stat="funnel"]', `${fmt(s.collected)} → ${fmt(s.unique)}`);
  set('[data-stat="concepts"]', s.concepts);
  set('[data-stat="edges"]', s.edges);
  const recent = document.querySelector('#recent-list');
  recent.replaceChildren(...graph.recent.map((r) => {
    const li = document.createElement('li');
    const time = document.createElement('time'); time.dateTime = r.date; time.textContent = r.date.slice(5).replace('-', '/') + ' · ' + (r.kind === 'paper' ? 'paper' : 'repo');
    const div = document.createElement('div');
    const a = document.createElement('a'); a.href = r.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = r.title;
    const small = document.createElement('small'); small.textContent = r.one;
    div.append(a, small); li.append(time, div); return li;
  }));
  syncGraphMotion = readingGraph(graph, { svg: document.querySelector('#reading-graph'), card: document.querySelector('#graph-card'), controls: document.querySelector('.graph-controls'), reduced: () => paused || reduced.matches });
}).catch(() => { document.querySelector('#graph-card').innerHTML = '<p class="empty">The reading graph could not load. The pipeline itself is at <a href="https://github.com/Solvement/jarvis-digest">github.com/Solvement/jarvis-digest</a>.</p>'; });

fetch('data/notes.json').then((r) => r.json()).then(renderNotes).catch(() => {
  document.querySelector('#notes-index').innerHTML = '<li class="note-row"><span class="no">—</span><span class="series">Notes</span><div class="body"><p class="sum">The index could not load. Find the notes on Xiaohongshu under ID 2063539021ykw.</p></div></li>';
});
