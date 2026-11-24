async function requireAdminAuth() {
  try {
    const { user } = await api.me();
    if (user.role !== 'admin') {
      window.location.href = 'login.html';
      return null;
    }
    window.currentAdmin = user;
    return user;
  } catch (err) {
    window.location.href = 'login.html';
    return null;
  }
}
