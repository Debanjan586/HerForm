// ===================================================================
// flame.js — animated flame with flying embers.
//   flame.create(container, { size, embers, ignite })  build it once
//   flame.burst(container, count)                      one-off spray of sparks
// The flame is 5 layered SVG shapes (outer body, side tongues, tip,
// mid, inner, core); each layer flickers on its own timing (flame.css),
// and every ember gets its own random size / drift / speed / delay.
// ===================================================================
(function () {
  const rand = (a, b) => a + Math.random() * (b - a);

  const SVG = `
    <svg class="flame-svg" viewBox="0 0 100 140" aria-hidden="true">
      <path class="fl fl-tl" d="M36 92 C20 76 18 52 30 30 C32 50 44 62 46 88 Z"/>
      <path class="fl fl-tr" d="M64 92 C82 74 84 50 72 26 C68 48 56 60 54 88 Z"/>
      <path class="fl fl-tip" d="M50 0 C60 22 64 42 56 66 L44 66 C38 42 42 22 50 0 Z"/>
      <path class="fl fl-outer" d="M50 14 C55 34 72 46 77 70 C83 92 80 114 64 128 C58 134 54 137 50 137 C46 137 42 134 36 128 C20 114 17 92 23 70 C28 46 45 34 50 14 Z"/>
      <path class="fl fl-mid" d="M50 40 C54 58 66 68 68 90 C70 108 62 122 50 129 C38 122 30 108 32 90 C34 68 46 58 50 40 Z"/>
      <path class="fl fl-inner" d="M50 68 C53 82 62 92 62 106 C62 118 56 125 50 127 C44 125 38 118 38 106 C38 92 47 82 50 68 Z"/>
      <path class="fl fl-core" d="M50 98 C52 106 57 111 57 117 C57 123 54 126 50 127 C46 126 43 123 43 117 C43 111 48 106 50 98 Z"/>
    </svg>`;

  function makeEmber(size) {
    const el = document.createElement('span');
    const r = Math.random();
    el.className = 'flame-ember' + (r < 0.3 ? ' tear' : '') + (r > 0.75 ? ' hot' : '');
    el.style.setProperty('--s', rand(size * 0.045, size * 0.1).toFixed(1) + 'px');
    el.style.setProperty('--x', rand(-size * 0.5, size * 0.5).toFixed(1) + 'px');
    el.style.setProperty('--rise', rand(size * 0.8, size * 1.7).toFixed(1) + 'px');
    el.style.setProperty('--dur', rand(1.8, 3.4).toFixed(2) + 's');
    el.style.setProperty('--delay', (-rand(0, 3.4)).toFixed(2) + 's'); // negative = already mid-flight
    return el;
  }

  function create(container, opts = {}) {
    if (!container) return null;
    const size = opts.size || 56;
    const embers = opts.embers == null ? 12 : opts.embers;

    const existing = container.querySelector('.flame');
    if (existing) return existing;

    const root = document.createElement('div');
    root.className = 'flame' + (opts.ignite === false ? '' : ' ignite');
    root.style.width = size + 'px';
    root.style.height = Math.round(size * 1.4) + 'px';
    root.dataset.size = size;
    root.innerHTML = `<div class="flame-glow"></div>${SVG}<div class="flame-embers"></div>`;

    const wrap = root.querySelector('.flame-embers');
    for (let i = 0; i < embers; i++) wrap.appendChild(makeEmber(size));

    container.appendChild(root);
    return root;
  }

  function burst(container, count = 18) {
    const root = container && (container.classList.contains('flame') ? container : container.querySelector('.flame'));
    if (!root) return;
    const size = Number(root.dataset.size) || 56;
    const wrap = root.querySelector('.flame-embers');
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = 'flame-ember burst' + (Math.random() > 0.6 ? ' hot' : '');
      const angle = rand(-Math.PI * 0.95, -Math.PI * 0.05); // upward fan
      const dist = rand(size * 0.7, size * 1.6);
      el.style.setProperty('--s', rand(size * 0.05, size * 0.11).toFixed(1) + 'px');
      el.style.setProperty('--bx', (Math.cos(angle) * dist).toFixed(1) + 'px');
      el.style.setProperty('--by', (Math.sin(angle) * dist).toFixed(1) + 'px');
      el.style.setProperty('--dur', rand(0.8, 1.4).toFixed(2) + 's');
      el.style.setProperty('--delay', rand(0, 0.25).toFixed(2) + 's');
      wrap.appendChild(el);
      setTimeout(() => el.remove(), 1900);
    }
  }

  window.flame = { create, burst };
})();