// ===================================================================
// Home page logic — greeting rotation, scrollable day cards, weekly
// dot tracker, streak banner with particle burst, and the day-info
// popup. Split out from index.html's old inline <script> per the
// no-inline-script/style convention used across every page now.
// ===================================================================

// Rotating greeting lines. The motivational quote card is separate
// and always shows exactly what the API returns — untouched.
const GREETINGS = ['Hello', 'Welcome back', 'Hey', 'Good to see you', 'Hi'];

(async function init() {
  const user = await requireUserAuth();
  if (!user) return;

  if (user.consent && user.consent.activityTracking) {
    window.activityTracker.start();
  }

  document.getElementById('dayPopupIcon').innerHTML = iconSvg('lock', 26);

  try {
    const [{ workouts }, summary, quoteData] = await Promise.all([
      api.getWorkouts(),
      api.getProgressSummary(),
      api.getTodayQuote()
    ]);

    // --- Quote (unchanged, exactly as returned) ---
    const quoteSection = document.getElementById('quoteSection');
    if (quoteData.quote) {
      quoteSection.innerHTML = `
        <div class="quote-card">
          <div class="quote-icon-wrap">${iconSvg(quoteData.quote.icon, 18)}</div>
          <div>
            <div class="quote-text">"${quoteData.quote.text}"</div>
            ${quoteData.quote.author ? `<div class="quote-author">— ${quoteData.quote.author}</div>` : ''}
          </div>
        </div>`;
    }

    const completedDays = new Set(
      summary.calendar.filter((c) => c.completed).map((c) => c.day)
    );
    const enabledWorkouts = workouts.filter((w) => w.enabled);

    const todayWorkout = pickCurrentWorkout(workouts, summary.calendar);

    // --- Greeting (rotates each visit) ---
    const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    document.getElementById('greetingText').textContent = `${greeting}, ${user.name}`;
    document.getElementById('weekText').textContent = `Week ${todayWorkout.week} of 12`;

    // --- Day card row: today + next 2 upcoming, horizontal scroll ---
    const todayDone = completedDays.has(todayWorkout.day) || todayWorkout.isRestDay;
    const upcoming = enabledWorkouts
      .filter((w) => w.day > todayWorkout.day)
      .slice(0, 2);

    const cardScroll = document.getElementById('dayCardScroll');
    const cardsHtml = [renderDayCard(todayWorkout, { locked: false, isToday: true, cardIndex: 0 })]
      .concat(
        upcoming.map((w, i) =>
          renderDayCard(w, { locked: !todayDone, isToday: false, cardIndex: i + 1 })
        )
      )
      .join('');
    cardScroll.innerHTML = cardsHtml || `<div class="card" style="text-align:center;color:var(--color-text-muted);width:100%;">Programme complete! 🎉</div>`;

    // Wire up card click -> open popup (buttons inside also stop propagation handled by same handler)
    cardScroll.querySelectorAll('.day-card').forEach((cardEl) => {
      cardEl.addEventListener('click', () => {
        const dayNum = Number(cardEl.dataset.day);
        const isLocked = cardEl.dataset.locked === 'true';
        const workout = dayNum === todayWorkout.day
          ? todayWorkout
          : upcoming.find((w) => w.day === dayNum);
        openDayPopup(workout, isLocked);
      });
    });

    // --- Weekly 7-day date tracker (real calendar week) ---
    renderWeekDots(summary.calendar);

    // --- Weekly + program stats ---
    document.getElementById('weeklyCompletedStat').textContent = summary.weeklyCompletedCount;
    document.getElementById('programProgressStat').textContent = `${summary.programProgress}%`;

    // --- Streak banner ---
    renderStreak(summary.calendar);

    // --- Popup close wiring ---
    document.getElementById('popupCloseX').addEventListener('click', closeDayPopup);
    document.getElementById('dayPopupOverlay').addEventListener('click', (e) => {
      if (e.target.id === 'dayPopupOverlay') closeDayPopup();
    });

    // --- Theme toggle ---
    document.getElementById('themeToggleBtn').addEventListener('click', () => {
      window.herformTheme.toggle();
    });

    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('appShell').style.display = 'block';
    renderBottomNav('index');
  } catch (err) {
    document.getElementById('loadingState').style.display = 'none';
    document.body.innerHTML += `<div class="error-state">Could not load your dashboard. ${err.message}</div>`;
  }
})();

// ===== Day card markup =====
// Uses a single placeholder "woman standing" figure image for every
// card (swap PLACEHOLDER_FIGURE_URL for the real asset path later).
// The figure sits in its own layer above/beside the card body (see
// home.css .day-card-figure) so it can pop outside the card's top
// edge for the 3D effect, rather than being clipped by the card.
const PLACEHOLDER_FIGURE_URL = 'assets/figure-placeholder.png';

function renderDayCard(workout, { locked, isToday, cardIndex }) {
  const btnLabel = workout.isRestDay ? 'View Recovery' : 'Start Workout';

  return `
    <div class="day-card ${locked ? 'locked' : ''}" data-day="${workout.day}" data-locked="${locked}">
      <div class="day-card-body">
        <img class="day-card-figure" src="${PLACEHOLDER_FIGURE_URL}" alt=""
             onerror="this.classList.add('img-missing')" />
        <div class="day-card-scrim"></div>
        <div class="day-card-index-badge">${cardIndex === 0 ? 'Today' : `+${cardIndex}`}</div>
        <div class="day-card-content">
          <div class="day-card-label">Day ${workout.day}</div>
          <div class="day-card-title">${workout.title}</div>
          <div class="day-card-meta">${workout.isRestDay ? 'Rest & recovery' : `${workout.exercises.length} exercises`}</div>
          <div class="day-card-btn">
            ${iconSvg(locked ? 'lock' : 'trending-up', 16)}
            ${locked ? 'Locked' : btnLabel}
          </div>
        </div>
      </div>
    </div>`;
}

// ===== Weekly date tracker =====
// Shows the real current calendar week (Mon–Sun) with actual dates,
// not the abstract 1-84 programme day numbers. A date is marked
// "done" if the user completed their programme workout on that real
// calendar date — inferred from each completed session's completedAt
// timestamp in summary.calendar, not from the programme day index.
function renderWeekDots(calendar) {
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Monday-start week
  const jsDay = today.getDay(); // 0 = Sun
  const mondayOffset = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);

  const completedDates = new Set(
    calendar
      .filter((c) => c.completed && c.completedAt)
      .map((c) => new Date(c.completedAt).toDateString())
  );

  const dotsHtml = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const done = completedDates.has(d.toDateString());
    const isToday = d.toDateString() === today.toDateString();
    return `
      <div class="week-dot">
        <div class="week-dot-circle ${done ? 'filled' : ''} ${isToday ? 'today-marker' : ''}">
          ${done ? iconSvg('check-circle', 16) : d.getDate()}
        </div>
        <div class="week-dot-label">${dayLabels[i]}</div>
      </div>`;
  }).join('');

  document.getElementById('weekDots').innerHTML = dotsHtml;
}

// ===== Streak banner + particle burst =====
function renderStreak(calendar) {
  const streak = computeCurrentStreak(calendar);
  const banner = document.getElementById('streakBanner');

  if (streak <= 0) {
    banner.classList.remove('visible');
    return;
  }

  banner.classList.add('visible');
  document.getElementById('streakNumber').textContent = streak;
  flame.create(document.getElementById('streakFlame'), { size: 46, embers: 12 });

  const user = window.currentUser;
  const name = user ? user.name : '';
  document.getElementById('streakCaption').textContent = `Well done${name ? ', ' + name : ''} — don't lose the streak`;

  // Fire the particle burst only once per newly-completed day, tracked
  // via localStorage so reloading the same day doesn't replay it.
  const lastCelebratedKey = 'herform_streak_celebrated_count';
  const lastCelebrated = Number(localStorage.getItem(lastCelebratedKey) || 0);
  if (streak > lastCelebrated) {
    // wait for the banner to slide in before the sparks fly
    setTimeout(() => flame.burst(document.getElementById('streakFlame'), 20), 500);
    localStorage.setItem(lastCelebratedKey, String(streak));
  }
}

function computeCurrentStreak(calendar) {
  const completedDays = new Set(calendar.filter((c) => c.completed).map((c) => c.day));
  if (completedDays.size === 0) return 0;

  const maxCompletedDay = Math.max(...completedDays);
  let streak = 0;
  let day = maxCompletedDay;
  while (completedDays.has(day)) {
    streak++;
    day--;
  }
  return streak;
}

// ===== Day info popup =====
function openDayPopup(workout, locked) {
  const overlay = document.getElementById('dayPopupOverlay');
  const icon = document.getElementById('dayPopupIcon');
  const title = document.getElementById('dayPopupTitle');
  const message = document.getElementById('dayPopupMessage');
  const actionBtn = document.getElementById('dayPopupActionBtn');

  title.textContent = `Day ${workout.day} — ${workout.title}`;

  if (locked) {
    icon.innerHTML = iconSvg('lock', 26);
    message.textContent = "Complete today's workout first to unlock this day.";
    actionBtn.textContent = 'Locked';
    actionBtn.disabled = true;
    actionBtn.onclick = null;
  } else {
    icon.innerHTML = iconSvg(workout.isRestDay ? 'leaf' : 'trending-up', 26);
    message.textContent = workout.isRestDay
      ? 'Today is about recovery — gentle movement and rest.'
      : `${workout.exercises.length} exercises ready for you.`;
    actionBtn.textContent = workout.isRestDay ? 'View Recovery' : 'Start Workout';
    actionBtn.disabled = false;
    actionBtn.onclick = () => {
      ui.go(`workout-day.html?day=${workout.day}`);
    };
  }

  overlay.classList.add('show');
}

function closeDayPopup() {
  const overlay = document.getElementById('dayPopupOverlay');
  overlay.classList.remove('show');
}