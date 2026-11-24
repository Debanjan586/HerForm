async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    if (data && data.retryAfterSeconds) err.retryAfterSeconds = data.retryAfterSeconds;
    throw err;
  }
  return data;
}

const api = {
  login: (email, password) =>
    apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => apiRequest('/auth/admin/logout', { method: 'POST' }),
  me: () => apiRequest('/auth/admin/me'),

  // ---- Users ----
  getUsers: () => apiRequest('/users'),
  createUser: (payload) => apiRequest('/users', { method: 'POST', body: JSON.stringify(payload) }),
  updateUser: (id, payload) => apiRequest(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteUser: (id) => apiRequest(`/users/${id}`, { method: 'DELETE' }),

  getOverview: () => apiRequest('/admin/overview'),
  getMonitoring: () => apiRequest('/admin/monitoring'),
  getAnalytics: () => apiRequest('/admin/analytics'),
  getActivity: (from, to) => {
    const qs = new URLSearchParams();
    if (from) qs.set('from', from);
    if (to) qs.set('to', to);
    return apiRequest(`/activity/admin?${qs.toString()}`);
  },

  // ---- Exercise library ----
  getExerciseLibrary: (includeArchived) =>
    apiRequest(`/exercises${includeArchived ? '?includeArchived=true' : ''}`),
  getExercise: (id) => apiRequest(`/exercises/${id}`),
  createExercise: (payload) =>
    apiRequest('/exercises', { method: 'POST', body: JSON.stringify(payload) }),
  updateExerciseLibrary: (id, payload) =>
    apiRequest(`/exercises/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteExercise: (id) => apiRequest(`/exercises/${id}`, { method: 'DELETE' }),

  // ---- Day Builder ----
  getWorkouts: () => apiRequest('/workouts'),
  getWorkoutByDay: (day) => apiRequest(`/workouts/day/${day}`),
  saveWorkoutInfo: (payload) =>
    apiRequest('/workouts', { method: 'POST', body: JSON.stringify(payload) }),
  toggleWorkout: (id) => apiRequest(`/workouts/${id}/toggle`, { method: 'PATCH' }),
  addExerciseToDay: (workoutId, payload) =>
    apiRequest(`/workouts/${workoutId}/exercises`, { method: 'POST', body: JSON.stringify(payload) }),
  updateDayExerciseTiming: (workoutId, entryId, payload) =>
    apiRequest(`/workouts/${workoutId}/exercises/${entryId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    }),
  removeExerciseFromDay: (workoutId, entryId) =>
    apiRequest(`/workouts/${workoutId}/exercises/${entryId}`, { method: 'DELETE' }),
  // Add many library exercises at once: { category: 'Core' } or { exerciseIds: [...] }
  addExercisesBulk: (workoutId, payload) =>
    apiRequest(`/workouts/${workoutId}/exercises/bulk`, { method: 'POST', body: JSON.stringify(payload) }),
  // Copy a day's exercises onto other days: { targetDays: [..], mode: 'replace' | 'append' }
  copyDay: (workoutId, payload) =>
    apiRequest(`/workouts/${workoutId}/copy`, { method: 'POST', body: JSON.stringify(payload) }),
  reorderDayExercises: (workoutId, entryIds) =>
    apiRequest(`/workouts/${workoutId}/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ entryIds })
    }),

  // ---- Quotes ----
  getQuotes: () => apiRequest('/quotes'),
  createQuote: (payload) => apiRequest('/quotes', { method: 'POST', body: JSON.stringify(payload) }),
  updateQuote: (id, payload) =>
    apiRequest(`/quotes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteQuote: (id) => apiRequest(`/quotes/${id}`, { method: 'DELETE' }),

  // ---- Uploads ----
  getUploadSignature: (folder) =>
    apiRequest(`/uploads/signature?folder=${encodeURIComponent(folder || 'herform')}`),
  deleteUploadedImage: (publicId) =>
    apiRequest('/uploads', { method: 'DELETE', body: JSON.stringify({ publicId }) })
};