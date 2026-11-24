// Applied synchronously in <head>, before first paint, so there's never a
// flash of the wrong theme. Persisted in localStorage; falls back to the
// device's OS-level preference on first visit.
(function () {
  const STORAGE_KEY = 'herform_theme';

  function getPreferredTheme() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  applyTheme(getPreferredTheme());

  // Exposed for the toggle button, wired up once the DOM is ready.
  window.herformTheme = {
    get: () => document.documentElement.getAttribute('data-theme'),
    toggle: () => {
      const next = window.herformTheme.get() === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    }
  };
})();