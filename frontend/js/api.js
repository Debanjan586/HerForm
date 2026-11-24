// Thin wrapper around fetch() that always sends cookies for session auth.
async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    /* no JSON body */
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    if (data && data.retryAfterSeconds) err.retryAfterSeconds = data.retryAfterSeconds;
    throw err;
  }
  return data;
}

const api = {
  login: (email, password) =>
    apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => apiRequest('/auth/user/logout', { method: 'POST' }),
  me: () => apiRequest('/auth/user/me'),
  updateConsent: (activityTracking) =>
    apiRequest('/auth/user/consent', { method: 'PATCH', body: JSON.stringify({ activityTracking }) }),

  getWorkouts: () => apiRequest('/workouts'),
  getWorkoutByDay: (day) => apiRequest(`/workouts/day/${day}`),

  getProgressSummary: () => apiRequest('/progress/summary'),
  getDayProgress: (day) => apiRequest(`/progress/day/${day}`),
  isDayLocked: (day) => apiRequest(`/progress/is-day-locked/${day}`),
  completeSet: (workoutId, workoutEntryId, exerciseId, day, setNumber) =>
    apiRequest('/progress/complete-set', {
      method: 'POST',
      body: JSON.stringify({ workoutId, workoutEntryId, exerciseId, day, setNumber })
    }),

  getTodayQuote: () => apiRequest('/quotes/today'),

  heartbeat: () => apiRequest('/activity/heartbeat', { method: 'POST' }),
  endSession: () => apiRequest('/activity/end', { method: 'POST' }),
  myActivity: () => apiRequest('/activity/mine')
};