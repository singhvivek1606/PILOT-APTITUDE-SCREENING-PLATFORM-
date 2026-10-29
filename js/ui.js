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

function heroGauge() {
  const ticks = [];
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2 - Math.PI / 2;
    const long = i % 3 === 0;
    const r1 = long ? 118 : 126, r2 = 138;
    const x1 = 150 + Math.cos(a) * r1, y1 = 150 + Math.sin(a) * r1;
    const x2 = 150 + Math.cos(a) * r2, y2 = 150 + Math.sin(a) * r2;
    ticks.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#7f9aaa" stroke-width="${long ? 2 : 1}"/>`);
  }
  return `
    <svg viewBox="0 0 300 300" role="img" aria-label="Decorative flight instrument">
      <circle cx="150" cy="150" r="146" fill="#0f1a24" stroke="#34495a" stroke-width="2"/>
      <circle cx="150" cy="150" r="138" fill="none" stroke="#4a6070"/>
      ${ticks.join('')}
      <line x1="12" y1="150" x2="288" y2="150" stroke="#2e4252" stroke-dasharray="3 6"/>
      <line x1="150" y1="12" x2="150" y2="288" stroke="#2e4252" stroke-dasharray="3 6"/>
      <path d="M150 150 L205 95" stroke="#3fa9e8" stroke-width="3" stroke-linecap="round"/>
      <circle cx="150" cy="150" r="7" fill="#3fa9e8" stroke="#d8eefc" stroke-width="2"/>
      <path d="M150 20 L143 38 L157 38 Z" fill="#e0a04a"/>
      <text x="150" y="168" fill="#8ba8b8" font-family="monospace" font-size="11" text-anchor="middle" letter-spacing="2">PFD</text>
    </svg>`;
}

function memoryPreview() {
  return `
    <div class="data-plate" aria-hidden="true">
      <div class="data-plate-title">New Data</div>
      <div class="data-row"><span class="lbl">Altitude</span><span class="ident">(a)</span><span class="val">12,000</span></div>
      <div class="data-row"><span class="lbl">Speed</span><span class="ident">(s)</span><span class="val">240</span></div>
      <div class="data-row"><span class="lbl">Heading</span><span class="ident">(h)</span><span class="val">090</span></div>
      <div class="data-row"><span class="lbl">Radio</span><span class="ident">(r)</span><span class="val">121.50</span></div>
    </div>`;
}

function controlPreview() {
  return `
    <svg viewBox="0 0 320 260" role="img" aria-label="Control instrument preview">
      <!-- Dial -->
      <circle cx="160" cy="105" r="86" fill="#8a99a4"/>
      <circle cx="160" cy="105" r="78" fill="#0f1a24"/>
      ${Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
        const long = i % 3 === 0;
        const r1 = long ? 64 : 68, r2 = 74;
        return `<line x1="${160 + Math.cos(a) * r1}" y1="${105 + Math.sin(a) * r1}"
                     x2="${160 + Math.cos(a) * r2}" y2="${105 + Math.sin(a) * r2}"
                     stroke="${long ? '#7f9aaa' : '#4a6070'}" stroke-width="${long ? 2 : 1}"/>`;
      }).join('')}
      <path d="M160 105 L208 72" stroke="#3fa9e8" stroke-width="3" stroke-linecap="round"/>
      <circle cx="160" cy="105" r="5" fill="#3fa9e8" stroke="#d8eefc" stroke-width="1.5"/>
      <line x1="160" y1="27" x2="160" y2="45" stroke="#e04848" stroke-width="4" stroke-linecap="round"/>
      <!-- Bar -->
      <rect x="30" y="210" width="260" height="34" fill="#8a99a4" rx="2"/>
      <rect x="36" y="216" width="248" height="22" fill="#0f1a24" rx="1"/>
      <line x1="160" y1="216" x2="160" y2="238" stroke="#e04848" stroke-width="2"/>
      <circle cx="135" cy="227" r="7" fill="#3fa9e8" stroke="#d8eefc" stroke-width="1.5"/>
    </svg>`;
}

function slalomPreview() {
  return `
    <svg viewBox="0 0 220 180" role="img" aria-label="Slalom preview">
      <rect width="220" height="180" fill="#0f1a24"/>
      ${[40, 80, 120, 160].map(y => `
        <circle cx="70" cy="${y}" r="5" fill="#d94a4e"/>
        <circle cx="150" cy="${y}" r="5" fill="#5fbf8f"/>`).join('')}
      <path d="M110 150 L98 164 L110 158 L122 164 Z" fill="#3fa9e8" stroke="#d8eefc"/>
    </svg>`;
}

function orientationPreview() {
  return `
    <svg viewBox="0 0 240 140" role="img" aria-label="Orientation instruments">
      ${[40, 120, 200].map(cx => `
        <rect x="${cx - 34}" y="20" width="68" height="68" fill="#34495a" rx="2"/>
        <circle cx="${cx}" cy="54" r="28" fill="#0f1a24"/>`).join('')}
      <text x="40" y="106" fill="#8ba8b8" font-size="10" text-anchor="middle">RBI</text>
      <text x="120" y="106" fill="#8ba8b8" font-size="10" text-anchor="middle">HORIZON</text>
      <text x="200" y="106" fill="#8ba8b8" font-size="10" text-anchor="middle">COMPASS</text>
    </svg>`;
}

function mathsPreview() {
  return `
    <div style="padding:22px;text-align:left;font-family:var(--mono);color:#dbe7ee;font-size:12px;line-height:1.7">
      <div style="color:#7f9aaa;font-size:9px;letter-spacing:.15em;text-transform:uppercase;margin-bottom:8px">QUESTION 1 / 8</div>
      <div>A car travels 23 km in 20 minutes.<br>What is its average speed in km/hr?</div>
      <div style="margin-top:16px;border-top:1px dashed #34495a;padding-top:10px;color:#7f9aaa">Answer: ______</div>
    </div>`;
}

function taskPreview() {
  return `
    <svg viewBox="0 0 220 160" role="img" aria-label="Task manager preview">
      <rect x="14" y="20" width="86" height="46" fill="#0f1a24" stroke="#34495a"/>
      <text x="24" y="40" fill="#7f9aaa" font-size="8">ALTITUDE</text>
      <text x="24" y="56" fill="#dbe7ee" font-size="12" font-family="monospace">12,000</text>
      <rect x="120" y="20" width="86" height="46" fill="#0f1a24" stroke="#34495a"/>
      <text x="130" y="40" fill="#7f9aaa" font-size="8">HEADING</text>
      <text x="130" y="56" fill="#dbe7ee" font-size="12" font-family="monospace">270°</text>
      <rect x="14" y="84" width="192" height="52" fill="#a83a2c" stroke="#c44536"/>
      <text x="110" y="115" fill="#fff" font-size="12" font-weight="700" text-anchor="middle" font-family="sans-serif">⚠ WARNING — PRESS SPACE</text>
    </svg>`;
}

function planeSvg(heading) {
  return `<svg viewBox="0 0 44 44" style="transform:rotate(${heading}deg)" aria-hidden="true">
    <path d="M22 2l5 17 13 6v5l-15-4v9l6 3v3l-9-2-9 2v-3l6-3v-9L4 30v-5l13-6z" fill="currentColor"/>
  </svg>`;
}

function scoreChart(rows) {
  if (!rows.length) return '';
  const values = rows.slice(0, 8).reverse();
  const w = 580, h = 230;
  let grid = '', path = '', dots = '';
  for (let n = 0; n <= 4; n++) {
    const y = 180 - 36 * n;
    grid += `<line x1="50" y1="${y}" x2="554" y2="${y}" stroke="#c3ced5"/>`;
    grid += `<text x="43" y="${y + 4}" font-size="11" text-anchor="end" fill="#748690">${n * 25}</text>`;
  }
  values.forEach((r, i) => {
    const x = 55 + i * (495 / Math.max(1, values.length - 1));
    const y = 180 - 1.44 * clamp(r.score, 0, 100);
    path += (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
    dots += `<circle cx="${x}" cy="${y}" r="4" fill="#1e5a8a"/>`;
    dots += `<text x="${x}" y="209" font-size="11" text-anchor="middle" fill="#748690">${i + 1}</text>`;
  });
  return `<svg class="chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Score trend">
    ${grid}<path d="${path}" fill="none" stroke="#1e5a8a" stroke-width="2.5"/>${dots}
  </svg><p class="small muted">Each point is one scored assessment, oldest to newest.</p>`;
}

return { escapeHtml, clamp, rand, pad, fmtTime, toast, heroGauge, memoryPreview, controlPreview, slalomPreview, orientationPreview, mathsPreview, taskPreview, planeSvg, scoreChart };
})();
