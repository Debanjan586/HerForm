function renderSidebar(activePage) {
  const items = [
    { page: 'overview', href: 'overview.html', label: 'Overview', icon: 'layout-dashboard' },
    { page: 'users', href: 'users.html', label: 'Users', icon: 'users' },
    { page: 'exercises', href: 'exercises.html', label: 'Exercises Library', icon: 'dumbbell' },
    { page: 'daybuilder', href: 'daybuilder.html', label: 'Day Builder', icon: 'calendar-plus' },
    { page: 'quotes', href: 'quotes.html', label: 'Quotes', icon: 'quote' },
    { page: 'activity', href: 'activity.html', label: 'User Activity', icon: 'activity' },
    { page: 'monitoring', href: 'monitoring.html', label: 'Workout Monitoring', icon: 'target' },
    { page: 'analytics', href: 'analytics.html', label: 'Analytics', icon: 'bar-chart-2' }
  ];

  const icons = {
    'layout-dashboard': '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    'bar-chart-2': '<path d="M18 20V10M12 20V4M6 20v-6"/>',
    dumbbell: '<path d="M14.4 14.4 9.6 9.6"/><path d="M18.657 21.485a2 2 0 1 1-2.829-2.828l-1.767 1.768a2 2 0 1 1-2.829-2.829l6.364-6.364a2 2 0 1 1 2.829 2.829l-1.768 1.767a2 2 0 1 1 2.828 2.829z"/><path d="m21.5 21.5-1.4-1.4"/><path d="M3.9 3.9 2.5 2.5"/><path d="M6.404 6.404a2 2 0 1 1 2.829 2.828l1.767-1.768a2 2 0 1 1 2.829 2.829l-6.364 6.364a2 2 0 1 1-2.829-2.829l1.768-1.767a2 2 0 1 1-2.828-2.829z"/>',
    'calendar-plus': '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M12 13v6M9 16h6"/>',
    quote: '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v4z"/>'
  };

  const html = `
    <aside class="sidebar">
      <div class="sidebar-brand">herform</div>
      <div class="sidebar-sub">Admin Console</div>
      <nav class="sidebar-nav">
        ${items
          .map(
            (item) => `
          <a class="sidebar-link ${item.page === activePage ? 'active' : ''}" href="${item.href}">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icons[item.icon]}</svg>
            ${item.label}
          </a>`
          )
          .join('')}
      </nav>
      <div class="sidebar-footer">
        <button class="sidebar-link" style="width:100%;" id="adminLogoutBtn">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
          Log Out
        </button>
      </div>
    </aside>
  `;

  document.body.insertAdjacentHTML('afterbegin', html);
  document.getElementById('adminLogoutBtn').addEventListener('click', async () => {
    await api.logout();
    window.location.href = 'login.html';
  });
}