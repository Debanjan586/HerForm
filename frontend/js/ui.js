// ===================================================================
// ui.js — shared motion + dialog layer (app and admin).
//   ui.confirm({ title, message, confirmText, cancelText, tone }) -> Promise<boolean>
//   ui.alert(message, { title, tone, okText })                     -> Promise<void>
//   ui.go(url)      animated page navigation (fade out, then go)
//   ui.remove(el)   animated removal of an element
// Also: page-leave fade on link clicks, and a staggered reveal of
// cards / rows / sections as they appear (including ones rendered
// later by other scripts).
// ===================================================================
(function () {
  const LEAVE_MS = 220;
  const CLOSE_MS = 220;

  // ---------- Navigation ----------
  function go(url) {
    if (document.documentElement.classList.contains('ui-leaving')) return;
    document.documentElement.classList.add('ui-leaving');
    setTimeout(() => { window.location.href = url; }, LEAVE_MS);
  }

  // Back/forward cache restores the page with the leaving class still set.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) document.documentElement.classList.remove('ui-leaving');
  });

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download')) return;
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname && url.search === window.location.search) return;
    e.preventDefault();
    go(url.href);
  });

  // ---------- Animated removal ----------
  function remove(el) {
    return new Promise((resolve) => {
      if (!el) return resolve();
      el.classList.add('ui-removing');
      setTimeout(() => { el.remove(); resolve(); }, 250);
    });
  }

  // ---------- Dialogs ----------
  const ICONS = {
    danger: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>',
    default: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4M12 17h.01"/></svg>',
    success: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m8 12.5 2.8 2.8L16 9.5"/></svg>',
    warning: '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  // Dialogs run one at a time so two never stack on top of each other.
  let queue = Promise.resolve();

  function openDialog({ title, message, tone = 'default', confirmText = 'OK', cancelText = null, dismissible = true, defaultFocus = null }) {
    return new Promise((resolve) => {
      const previouslyFocused = document.activeElement;
      const overlay = document.createElement('div');
      overlay.className = 'ui-dialog-overlay';
      const uid = 'uiDlg' + Date.now();
      const confirmClass = tone === 'danger' ? 'ui-btn-danger' : 'ui-btn-primary';

      overlay.innerHTML = `
        <div class="ui-dialog tone-${tone}" role="alertdialog" aria-modal="true" aria-labelledby="${uid}T" aria-describedby="${uid}M">
          <div class="ui-dialog-icon">${ICONS[tone] || ICONS.default}</div>
          <div class="ui-dialog-title" id="${uid}T">${esc(title)}</div>
          <div class="ui-dialog-message" id="${uid}M">${esc(message)}</div>
          <div class="ui-dialog-actions">
            ${cancelText ? `<button type="button" class="ui-btn ui-btn-ghost" data-act="cancel">${esc(cancelText)}</button>` : ''}
            <button type="button" class="ui-btn ${confirmClass}" data-act="ok">${esc(confirmText)}</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      let settled = false;
      function close(result) {
        if (settled) return;
        settled = true;
        document.removeEventListener('keydown', onKey, true);
        overlay.classList.remove('open');
        overlay.classList.add('closing');
        setTimeout(() => {
          overlay.remove();
          if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
          resolve(result);
        }, CLOSE_MS);
      }

      function onKey(e) {
        if (e.key === 'Escape' && dismissible) { e.preventDefault(); close(false); }
        if (e.key === 'Tab') {
          const btns = overlay.querySelectorAll('button');
          const first = btns[0], last = btns[btns.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
      document.addEventListener('keydown', onKey, true);

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay && dismissible) { close(false); return; }
        const btn = e.target.closest('button[data-act]');
        if (btn) close(btn.dataset.act === 'ok');
      });

      // Two frames so the starting (hidden) styles are painted first,
      // otherwise the open transition would be skipped.
      requestAnimationFrame(() => requestAnimationFrame(() => {
        overlay.classList.add('open');
        // Destructive prompts focus Cancel so Enter never deletes by accident.
        const focusTarget = cancelText && (tone === 'danger' || defaultFocus === 'cancel')
          ? overlay.querySelector('[data-act="cancel"]')
          : overlay.querySelector('[data-act="ok"]');
        if (focusTarget) focusTarget.focus({ preventScroll: true });
      }));
    });
  }

  function enqueue(opts) {
    const run = () => openDialog(opts);
    const p = queue.then(run, run);
    queue = p.catch(() => {});
    return p;
  }

  function confirmDialog(opts = {}) {
    return enqueue({
      title: opts.title || 'Are you sure?',
      message: opts.message || '',
      tone: opts.tone || 'default',
      confirmText: opts.confirmText || 'Confirm',
      cancelText: opts.cancelText || 'Cancel',
      dismissible: true,
      defaultFocus: opts.defaultFocus || null
    });
  }

  function alertDialog(message, opts = {}) {
    return enqueue({
      title: opts.title || 'Something went wrong',
      message,
      tone: opts.tone || 'danger',
      confirmText: opts.okText || 'Got it',
      cancelText: null,
      dismissible: true
    }).then(() => undefined);
  }

  // ---------- Staggered reveal ----------
  const REVEAL_SELECTOR = [
    '.top-bar', '.page > *', '.page-header', '.main-content > *',
    '.card', '.panel', '.stat-card', '.stat-chip', '.quote-card',
    '.section-heading', '.day-card', '.week-dot', '.exercise-meta',
    '.form-group', '.empty-state', '.quote-row', '.lib-card', '.btn-full'
  ].join(',');
  const SKIP_SELECTOR = [
    '.streak-banner', '.popup-overlay', '.ui-dialog-overlay', '.modal-overlay',
    '.modal-box', '.bottom-nav', '.loading-spinner', '.toast', '.player-shell',
    '.player-shell *', '[data-no-animate]', '[data-no-animate] *', 'script', 'style'
  ].join(',');

  let io = null;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function reveal(el) {
    el.classList.add('ui-in');
    setTimeout(() => el.classList.add('ui-done'), 1200);
  }

  function scan(root) {
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    if (!io) {
      io = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          io.unobserve(en.target);
          reveal(en.target);
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -4% 0px' });
    }
    const found = [];
    if (root.nodeType === 1 && root.matches(REVEAL_SELECTOR)) found.push(root);
    if (root.querySelectorAll) root.querySelectorAll(REVEAL_SELECTOR).forEach((n) => found.push(n));

    let i = 0;
    found.forEach((el) => {
      if (el.dataset.uiSeen || el.matches(SKIP_SELECTOR)) return;
      el.dataset.uiSeen = '1';
      el.style.setProperty('--ui-delay', Math.min(i, 9) * 60 + 'ms');
      el.classList.add('ui-reveal');
      io.observe(el);
      i++;
    });
  }

  function start() {
    scan(document.body);

    // Catch content rendered later by api calls / other scripts. (Hidden
    // containers like #appShell need nothing extra: their children are
    // already observed and reveal when the container becomes visible.)
    const mo = new MutationObserver((muts) => {
      muts.forEach((m) => {
        m.addedNodes.forEach((n) => { if (n.nodeType === 1) scan(n); });
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Safety net: never leave something invisible if the observer misses it.
    setTimeout(() => {
      document.querySelectorAll('.ui-reveal:not(.ui-in)').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0 && r.width > 0) reveal(el);
      });
    }, 1800);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.ui = { go, remove, confirm: confirmDialog, alert: alertDialog };
})();