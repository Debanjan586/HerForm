function renderBottomNav(activePage) {
  const items = [
    { page: 'index', href: 'index.html', label: 'Home', icon: 'home' },
    { page: 'program', href: 'program.html', label: 'Program', icon: 'calendar' },
    { page: 'progress', href: 'progress.html', label: 'Progress', icon: 'trending-up' },
    { page: 'profile', href: 'profile.html', label: 'Profile', icon: 'user' }
  ];

  const icons = {
    home: '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5Z"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    'trending-up': '<path d="m3 17 6-6 4 4 7-8"/><path d="M15 7h5v5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>'
  };

  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.innerHTML = items
    .map(
      (item) => `
      <a class="nav-item ${item.page === activePage ? 'active' : ''}" href="${item.href}">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[item.icon]}</svg>
        <span>${item.label}</span>
      </a>`
    )
    .join('');
  document.body.appendChild(nav);
}