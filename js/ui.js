// Browser-ready: works even when index.html is opened directly (file://).
window.AVUI = (() => {
  'use strict';
// ============================================================
// ui.js — pure helpers, SVG builders, toast
// ============================================================

const escapeHtml = v =>
  String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pad = n => String(n).padStart(2, '0');
const fmtTime = s => {
  const n = Math.ceil(Math.max(0, s));
  return pad(Math.floor(n / 60)) + ':' + pad(n % 60);
};

// --- toast ---

let toastTimer = null;
function toast(msg) {
  const el = document.getElementById('notice');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3600);
}

// --- SVGs ---
// Colours come from .pv-* / .chart-* classes in css/instrument.css,
// so every drawing follows the dark/light theme.

const PLANE_PATH = 'M22 2l5 17 13 6v5l-15-4v9l6 3v3l-9-2-9 2v-3l6-3v-9L4 30v-5l13-6z';
const polar = (cx, cy, r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [+(cx + Math.cos(a) * r).toFixed(2), +(cy + Math.sin(a) * r).toFixed(2)];
};

// Heading indicator: compass rose with a fixed aircraft symbol and lubber line.
function heroGauge() {
  const ticks = [];
  for (let d = 0; d < 360; d += 5) {
    const major = d % 30 === 0;
    const mid = d % 10 === 0;
    const [x1, y1] = polar(150, 150, major ? 112 : mid ? 120 : 125, d);
    const [x2, y2] = polar(150, 150, 132, d);
    ticks.push(`<line class="${major || mid ? 'pv-tick' : 'pv-tick-minor'}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${major ? 2 : 1}"/>`);
  }
  const marks = ['N', '3', '6', 'E', '12', '15', 'S', '21', '24', 'W', '30', '33'].map((t, i) => {
    const [x, y] = polar(150, 150, 96, i * 30);
    const cardinal = i % 3 === 0;
    return `<text class="${cardinal ? 'pv-ink' : 'pv-label'}" x="${x}" y="${y + 4}" font-size="${cardinal ? 13 : 10}" font-weight="${cardinal ? 700 : 500}" text-anchor="middle" transform="rotate(${i * 30} ${x} ${y})">${t}</text>`;
  });
  return `
    <svg viewBox="0 0 300 300" role="img" aria-label="Heading indicator">
      <circle class="pv-face" cx="150" cy="150" r="146"/>
      <circle class="pv-rim" cx="150" cy="150" r="146" stroke-width="1.5"/>
      <g class="pv-rose">${ticks.join('')}${marks.join('')}</g>
      <circle class="pv-rim" cx="150" cy="150" r="70" stroke-dasharray="2 5"/>
      <path class="pv-accent" d="M150 10 L143 26 L157 26 Z"/>
      <g transform="translate(128 128)"><path class="pv-ink" d="${PLANE_PATH}"/></g>
      <text class="pv-label" x="150" y="214" font-size="10" text-anchor="middle" letter-spacing="2">HDG</text>
    </svg>`;
}

// Circular progress ring. The arc length is driven by the --p custom property (0–1),
// so the tick loop can move it without re-rendering. pathLength=100 keeps the CSS simple.
function ring(p, { size = 64, stroke = 5, id = '', cls = '', inner = '' } = {}) {
  const c = size / 2, r = c - stroke / 2;
  return `<div class="ins-ring ${cls}"${id ? ` id="${id}"` : ''} style="--p:${clamp(Number(p) || 0, 0, 1).toFixed(3)};width:${size}px;height:${size}px">
    <svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle class="ins-ring-track" cx="${c}" cy="${c}" r="${r}" stroke-width="${stroke}"/>
      <circle class="ins-ring-arc" cx="${c}" cy="${c}" r="${r}" stroke-width="${stroke}" pathLength="100" transform="rotate(-90 ${c} ${c})"/>
    </svg>
    <div class="ins-ring-inner">${inner}</div>
  </div>`;
}

function memoryPreview() {
  const cells = [
    ['ALT', 'a', '12,400', 'ft'],
    ['IAS', 's', '245', 'kts'],
    ['HDG', 'h', '', 'MAG'],
    ['COM', 'r', '121.50', 'MHz'],
  ];
  return `
    <div class="ins-strip is-preview" aria-hidden="true">
      ${cells.map(([code, ident, val, unit]) => `
        <div class="ins-cell ${val ? '' : 'is-input'}">
          <div class="ins-cell-top"><span>${code}</span><span class="ins-ident">${ident}</span></div>
          <div class="ins-readout"><strong class="ins-value">${val || '– – –'}</strong><span class="ins-unit">${unit}</span></div>
        </div>`).join('')}
    </div>`;
}

function controlPreview() {
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const major = i % 3 === 0;
    const [x1, y1] = polar(160, 105, major ? 62 : 67, i * 15);
    const [x2, y2] = polar(160, 105, 73, i * 15);
    return `<line class="${major ? 'pv-tick' : 'pv-tick-minor'}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke-width="${major ? 2 : 1}"/>`;
  }).join('');
  return `
    <svg viewBox="0 0 320 260" role="img" aria-label="Control instrument preview">
      <circle class="pv-panel" cx="160" cy="105" r="84"/>
      <circle class="pv-face" cx="160" cy="105" r="78"/>
      <circle class="pv-rim" cx="160" cy="105" r="84" stroke-width="1.5"/>
      ${ticks}
      <line class="pv-target" x1="160" y1="28" x2="160" y2="44" stroke-width="4"/>
      <line class="pv-accent-line" x1="160" y1="105" x2="206" y2="72" stroke-width="3"/>
      <circle class="pv-hub" cx="160" cy="105" r="5" stroke-width="2"/>
      <rect class="pv-panel" x="30" y="206" width="260" height="38" rx="8"/>
      <rect class="pv-face" x="38" y="214" width="244" height="22" rx="4"/>
      <line class="pv-target" x1="160" y1="214" x2="160" y2="236" stroke-width="2"/>
      <circle class="pv-accent" cx="132" cy="225" r="7"/>
    </svg>`;
}

function slalomPreview() {
  return `
    <svg viewBox="0 0 220 180" role="img" aria-label="Slalom preview">
      <line class="pv-guide" x1="110" y1="0" x2="110" y2="180"/>
      ${[[22, 96], [56, 122], [90, 104], [122, 84]].map(([y, c]) => `
        <circle class="pv-port" cx="${c - 32}" cy="${y}" r="5"/>
        <circle class="pv-stbd" cx="${c + 32}" cy="${y}" r="5"/>`).join('')}
      <path class="pv-caution" d="M168 98 l7 12 h-14 z"/>
      <g transform="translate(99 148) scale(0.5)"><path class="pv-accent" d="${PLANE_PATH}"/></g>
    </svg>`;
}

function orientationPreview() {
  const dial = (cx, inner, label) => `
    <circle class="pv-face" cx="${cx}" cy="56" r="30"/>
    <circle class="pv-rim" cx="${cx}" cy="56" r="30" stroke-width="1.5"/>
    ${inner}
    <text class="pv-label" x="${cx}" y="110" font-size="9" text-anchor="middle">${label}</text>`;
  return `
    <svg viewBox="0 0 240 130" role="img" aria-label="Orientation instruments">
      ${dial(40, `<line class="pv-accent-line" x1="40" y1="56" x2="62" y2="56" stroke-width="2.5"/><circle class="pv-hub" cx="40" cy="56" r="3"/>`, 'RBI')}
      ${dial(120, `<line class="pv-tick" x1="94" y1="62" x2="146" y2="50" stroke-width="2"/><path class="pv-accent-line" d="M108 56 h8 l4 4 l4 -4 h8" stroke-width="2.5"/>`, 'HORIZON')}
      ${dial(200, `<text class="pv-ink" x="200" y="38" font-size="9" font-weight="700" text-anchor="middle">N</text><g transform="translate(189 45) scale(0.5)"><path class="pv-ink" d="${PLANE_PATH}"/></g>`, 'COMPASS')}
    </svg>`;
}

function mathsPreview() {
  return `
    <div class="pv-maths">
      <div class="pv-maths-q">Question 1 / 8</div>
      <div>An aircraft flies 480 km in 2 hours.<br>What is its ground speed in km/h?</div>
      <div class="pv-maths-a">Answer <span>240</span></div>
    </div>`;
}

function taskPreview() {
  const box = (x, label, value) => `
    <rect class="pv-face" x="${x}" y="18" width="88" height="48" rx="8"/>
    <rect class="pv-rim" x="${x}" y="18" width="88" height="48" rx="8"/>
    <text class="pv-label" x="${x + 10}" y="36" font-size="8">${label}</text>
    <text class="pv-ink pv-mono" x="${x + 10}" y="55" font-size="14">${value}</text>`;
  return `
    <svg viewBox="0 0 220 160" role="img" aria-label="Task manager preview">
      ${box(14, 'ALT', '12,000')}
      ${box(118, 'HDG', '270°')}
      <rect class="pv-warn" x="14" y="84" width="192" height="52" rx="8"/>
      <text class="pv-warn-text" x="110" y="115" font-size="11" text-anchor="middle">MASTER WARNING · SPACE</text>
    </svg>`;
}

function planeSvg(heading) {
  return `<svg viewBox="0 0 44 44" style="transform:rotate(${heading}deg)" aria-hidden="true">
    <path d="${PLANE_PATH}" fill="currentColor"/>
  </svg>`;
}

function scoreChart(rows) {
  if (!rows.length) return '';
  const values = rows.slice(0, 8).reverse();
  const w = 580, h = 230;
  const yOf = (score) => 180 - 1.44 * clamp(score, 0, 100);
  let grid = '', path = '', dots = '';
  for (let n = 0; n <= 4; n++) {
    const y = 180 - 36 * n;
    grid += `<line class="chart-grid" x1="50" y1="${y}" x2="554" y2="${y}"/>`;
    grid += `<text class="chart-label" x="43" y="${y + 4}" font-size="11" text-anchor="end">${n * 25}</text>`;
  }
  // Demo PASS threshold (60%)
  grid += `<line class="chart-pass" x1="50" y1="${yOf(60)}" x2="554" y2="${yOf(60)}"/>`;
  grid += `<text class="chart-pass-label" x="554" y="${yOf(60) - 6}" font-size="10" text-anchor="end">PASS 60</text>`;
  values.forEach((r, i) => {
    const x = 55 + i * (495 / Math.max(1, values.length - 1));
    const y = yOf(r.score);
    path += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
    dots += `<circle class="chart-dot" cx="${x}" cy="${y}" r="4"/>`;
    dots += `<text class="chart-label" x="${x}" y="209" font-size="11" text-anchor="middle">${i + 1}</text>`;
  });
  return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Score trend">
    ${grid}<path class="chart-line" d="${path}"/>${dots}
  </svg><p class="small muted">Each point is one scored assessment, oldest to newest. The dashed line marks the demo 60% pass mark.</p>`;
}

return { escapeHtml, clamp, rand, pad, fmtTime, toast, ring, heroGauge, memoryPreview, controlPreview, slalomPreview, orientationPreview, mathsPreview, taskPreview, planeSvg, scoreChart };
})();
