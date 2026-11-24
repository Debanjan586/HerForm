// Login lockout screen. When the server says "too many failed attempts"
// (HTTP 429 with retryAfterSeconds), the whole login page is replaced by a
// countdown. It survives a page refresh, and the login form comes back by
// itself when the timer reaches zero.
(function () {
  const STYLE = `
  .login-lock {
    position: fixed; inset: 0; z-index: 9999;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
    background: var(--color-bg); color: var(--color-text); text-align: center; padding: 24px;
    opacity: 0; visibility: hidden;
    transition: opacity 400ms var(--ease-smooth, ease), visibility 400ms;
  }
  .login-lock.show { opacity: 1; visibility: visible; }
  .login-lock-label { font-size: 0.85rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-text-muted); }
  .login-lock-time {
    font-family: var(--font-display, inherit); font-weight: 500;
    font-size: clamp(3.5rem, 18vw, 6rem); line-height: 1;
    font-variant-numeric: tabular-nums; color: var(--color-accent-dark);
  }`;

  function fmt(total) {
    const m = Math.floor(total / 60), s = total % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function create(storageKey) {
    const style = document.createElement('style');
    style.textContent = STYLE;
    document.head.appendChild(style);

    const el = document.createElement('div');
    el.className = 'login-lock';
    el.setAttribute('role', 'timer');
    el.innerHTML = '<div class="login-lock-label">Login locked</div><div class="login-lock-time" id="loginLockTime">--:--</div>';
    document.body.appendChild(el);
    const timeEl = el.querySelector('#loginLockTime');

    let tick = null;
    function until() {
      try { return Number(localStorage.getItem(storageKey)) || 0; } catch (e) { return 0; }
    }
    function store(ts) {
      try { ts ? localStorage.setItem(storageKey, String(ts)) : localStorage.removeItem(storageKey); } catch (e) {}
    }
    function stop() {
      clearInterval(tick); tick = null;
      el.classList.remove('show');
      store(0);
    }
    function update() {
      const left = Math.ceil((until() - Date.now()) / 1000);
      if (left <= 0) return stop();
      timeEl.textContent = fmt(left);
    }
    function engage(seconds) {
      store(Date.now() + Math.max(1, Number(seconds) || 1) * 1000);
      el.classList.add('show');
      update();
      clearInterval(tick);
      tick = setInterval(update, 250);
    }

    // Still locked from before a refresh?
    if (until() > Date.now()) engage((until() - Date.now()) / 1000);
    else store(0);

    return { engage, isLocked: () => until() > Date.now() };
  }

  window.loginLock = { create };
})();