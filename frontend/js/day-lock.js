// Only ONE day is open at a time: the first enabled, non-rest day that is
// not yet fully completed. Rest days have no sets so they can never be
// "completed" — they are skipped so they never block progress.
// Shared by the home page, programme page, workout-day and the player so
// they can never disagree about which day is open.
function pickCurrentWorkout(workouts, calendar) {
  const completed = new Set(calendar.filter((c) => c.completed).map((c) => c.day));
  const enabled = workouts.filter((w) => w.enabled);
  return (
    enabled.find((w) => !w.isRestDay && !completed.has(w.day)) ||
    enabled[enabled.length - 1] ||
    null
  );
}

async function getCurrentDayNumber() {
  const [{ workouts }, summary] = await Promise.all([api.getWorkouts(), api.getProgressSummary()]);
  const current = pickCurrentWorkout(workouts, summary.calendar);
  return current ? current.day : null;
}

// Consecutive completed days counting back from the latest completed one.
function computeStreakFromCalendar(calendar) {
  const done = new Set(calendar.filter((c) => c.completed).map((c) => c.day));
  if (done.size === 0) return 0;
  let day = Math.max(...done), streak = 0;
  while (done.has(day)) { streak++; day--; }
  return streak;
}

// A day can be opened if it is the current day, or one the user already
// completed (replaying it is allowed, after a confirmation on the programme page).
async function isDayOpenable(day) {
  const [{ workouts }, summary] = await Promise.all([api.getWorkouts(), api.getProgressSummary()]);
  const current = pickCurrentWorkout(workouts, summary.calendar);
  if (current && current.day === Number(day)) return true;
  return summary.calendar.some((c) => c.completed && c.day === Number(day));
}