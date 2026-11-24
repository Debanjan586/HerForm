// Include on every protected page. Redirects to login if not authenticated.
async function requireUserAuth() {
  try {
    const { user } = await api.me();
    if (user.role !== 'user') {
      window.location.href = 'login.html';
      return null;
    }
    window.currentUser = user;
    return user;
  } catch (err) {
    window.location.href = 'login.html';
    return null;
  }
}

function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
}