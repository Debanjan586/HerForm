// ===================================================================
// Workout player — countdown, timed work phase, rest phase, and the
// completion handoff. Moved out of workout-player.html's old inline
// <script> to match the no-inline-script convention used everywhere
// else in the app.
//
// Behavior per the latest spec:
//   - Rest between sets is a fixed ~25s countdown (REST_SECONDS below),
//     not the per-exercise restSeconds value from the backend data.
//   - During the work phase, the Next button is visible but disabled
//     (not clickable) until the timer reaches 0 — no skipping ahead.
//   - The instant the timer hits 0, the Done state (checkmark) and the
//     Next button both fade/scale in smoothly rather than snapping in.
//   - Every phase change (ready -> countdown -> work -> rest -> next)
//     crossfades the player shell instead of swapping innerHTML
//     instantly, so nothing ever "jumps".
// ===================================================================

const REST_SECONDS = 25;

const params = new URLSearchParams(window.location.search);
const day = Number(params.get('day'));
const shell = document.getElementById('playerShell');

let workout = null;
let plan = []; // flattened list of { entry, setNumber, isLastSetOfExercise, isFirstOverall }
let planIndex = 0;
let timerInterval = null;
let holdTimers = false; // timers freeze (not reset) while the exit dialog is open
let currentPhase = 'ready'; // ready | countdown | work | done-wait | rest

(async function init() {
  const user = await requireUserAuth();
  if (!user) return;

  if (!day) {
    renderShell(`<div class="error-state" style="color:var(--color-on-dark);">No workout day specified.</div>`);
    return;
  }

  try {
    // Only the current day can be played; everything else is locked.
    if (!(await isDayOpenable(day))) { ui.go('program.html'); return; }
    const { workout: w } = await api.getWorkoutByDay(day);
    workout = w;

    if (workout.isRestDay || workout.exercises.length === 0) {
      ui.go(`workout-day.html?day=${day}`);
      return;
    }

    buildPlan();
    renderReadyScreen();
  } catch (err) {
    renderShell(`<div class="error-state" style="color:var(--color-on-dark);">Could not load workout. ${err.message}</div>`);
  }
})();

function buildPlan() {
  plan = [];
  workout.exercises.forEach((entry, exIdx) => {
    for (let setNum = 1; setNum <= entry.sets; setNum++) {
      plan.push({
        entry,
        exerciseIndex: exIdx,
        setNumber: setNum,
        isLastSetOfExercise: setNum === entry.sets,
        isFirstSetOfExercise: setNum === 1,
        isLastExercise: exIdx === workout.exercises.length - 1
      });
    }
  });
}

// ===== Shell swap with crossfade =====
// Every phase renders through this instead of touching shell.innerHTML
// directly, so each transition fades the old phase out and the new
// one in rather than popping instantly. IMPORTANT: the HTML is not
// necessarily in the DOM the instant this function returns (the
// fade-out delay is async), so any code that wires up listeners on
// the new markup must run inside `afterRender`, never right after
// calling renderShell().
function renderShell(html, { instant = false, afterRender } = {}) {
  const finish = () => {
    shell.innerHTML = html;
    shell.classList.remove('phase-fade-out');
    shell.classList.add('phase-fade-in');
    requestAnimationFrame(() => shell.classList.remove('phase-fade-in'));
    if (afterRender) afterRender();
  };

  if (instant || !shell.firstElementChild) {
    finish();
    return;
  }

  shell.classList.add('phase-fade-out');
  setTimeout(finish, 220);
}

// ===== READY SCREEN =====
function renderReadyScreen() {
  renderShell(`
    <div class="player-ready-screen">
      <div class="player-ready-title">${workout.title}</div>
      <div class="player-ready-sub">${workout.exercises.length} exercises · ${plan.length} total sets</div>
      <button class="player-ready-btn" id="startBtn">Ready?</button>
    </div>
  `, {
    instant: true,
    afterRender: () => {
      document.getElementById('startBtn').addEventListener('click', () => {
        planIndex = 0;
        startStep();
      });
    }
  });
}

// ===== MAIN STEP DISPATCHER =====
function startStep() {
  if (planIndex >= plan.length) {
    goToCompletionScreen();
    return;
  }

  const step = plan[planIndex];
  const isTimedHold = step.entry.exercise.isTimedHold;

  // 3-2-1 countdown is ONLY for genuine timed-hold exercises (plank,
  // wall-sit, etc. — flagged by the backend via isTimedHold). Moving
  // between sets, and between regular exercises, always goes through
  // the rest timer instead (see handleSetDone / renderRestPhase).
  if (isTimedHold) {
    renderCountdown(() => renderWorkPhase(step));
  } else {
    renderWorkPhase(step);
  }
}

// ===== 3-2-1 COUNTDOWN =====
function renderCountdown(onComplete) {
  currentPhase = 'countdown';
  let count = 3;

  renderShell(`
    <div class="player-control-section player-center-section">
      <div class="player-timer countdown countdown-pop" id="countdownNum">${count}</div>
    </div>
  `, {
    afterRender: () => {
      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        if (holdTimers) return;
        count--;
        const el = document.getElementById('countdownNum');
        if (count > 0) {
          if (el) {
            // Restart the pop animation on every tick for a lively, non-abrupt feel
            el.classList.remove('countdown-pop');
            void el.offsetWidth; // force reflow so the animation re-triggers
            el.textContent = count;
            el.classList.add('countdown-pop');
          }
        } else {
          clearInterval(timerInterval);
          onComplete();
        }
      }, 1000);
    }
  });
}

// ===== WORK PHASE (the timed set itself) =====
function renderWorkPhase(step) {
  currentPhase = 'work';
  const ex = step.entry.exercise;
  // Timed holds can have a different duration for each set (admin sets it per set).
  const perSet = step.entry.setTimings && step.entry.setTimings[step.setNumber - 1];
  const totalSeconds = perSet || step.entry.workSeconds;
  let remaining = totalSeconds;
  let finished = false;

  const nextStep = plan[planIndex + 1];

  renderShell(`
    <div class="player-top-bar">
      <div class="player-close-btn" id="closeBtn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </div>
      ${nextStep ? `
        <div class="player-next-preview">
          ${nextStep.entry.exercise.imageUrl ? `<img src="${nextStep.entry.exercise.imageUrl}" alt="" />` : ''}
          <span>Next: ${nextStep.entry.exercise.name}</span>
        </div>` : ''}
    </div>

    <div class="player-image-section">
      ${ex.imageUrl
        ? `<img src="${ex.imageUrl}" alt="${ex.name}" />`
        : `<div class="player-image-fallback">${iconSvg('trending-up', 48)}</div>`}
    </div>

    <div class="player-control-section">
      <div class="player-exercise-name">${ex.name}</div>
      <div class="player-exercise-sub">Set ${step.setNumber} of ${step.entry.sets}${step.entry.reps ? ` · ${step.entry.reps}` : ''}</div>

      <div class="player-timer" id="workTimer">${formatTime(remaining)}</div>

      <div class="player-progress-row">
        <span>${planIndex + 1} of ${plan.length} sets</span>
        <span id="setsLeftLabel">${plan.length - planIndex - 1} remaining</span>
      </div>
      <div class="player-progress-track">
        <div class="player-progress-fill" style="width:${(planIndex / plan.length) * 100}%;"></div>
      </div>

      <div class="player-controls-row">
        <button class="player-side-btn fade-target" id="prevBtn" ${planIndex === 0 ? 'disabled' : ''}>Prev</button>
        <div class="player-main-btn" id="mainBtn">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
        </div>
        <button class="player-side-btn fade-target locked" id="nextBtn" disabled title="Finish this set first">Next</button>
      </div>
    </div>
  `, {
    afterRender: () => {
      document.getElementById('closeBtn').addEventListener('click', confirmExit);
      document.getElementById('prevBtn').addEventListener('click', () => {
        if (planIndex > 0) { planIndex--; startStep(); }
      });

      // Next stays disabled/unclickable the whole work phase — only wired
      // up for real once the timer reaches 0 (see the interval below).
      const nextBtn = document.getElementById('nextBtn');
      const armNextButton = () => {
        nextBtn.disabled = planIndex === plan.length - 1;
        nextBtn.classList.remove('locked');
        nextBtn.removeAttribute('title');
        // Fade it in rather than having it just "become" clickable
        nextBtn.classList.add('fade-in-soft');
        nextBtn.addEventListener('click', () => {
          if (planIndex < plan.length - 1) { planIndex++; startStep(); }
        }, { once: true });
      };

      let paused = false;
      const mainBtn = document.getElementById('mainBtn');
      mainBtn.addEventListener('click', () => {
        paused = !paused;
        mainBtn.innerHTML = paused
          ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`
          : `<svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`;
      });

      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        if (paused || finished || holdTimers) return;
        remaining--;
        const timerEl = document.getElementById('workTimer');
        if (remaining >= 0 && timerEl) timerEl.textContent = formatTime(remaining);

        if (remaining <= 0) {
          finished = true;
          clearInterval(timerInterval);
          armNextButton();
          renderDoneWait(step);
        }
      }, 1000);
    }
  });
}

// ===== DONE-WAIT (timer finished, waiting for user to tap Done) =====
// The checkmark state fades/scales in smoothly instead of snapping in,
// matching the Next button's fade-in above.
function renderDoneWait(step) {
  currentPhase = 'done-wait';
  const mainBtn = document.getElementById('mainBtn');
  if (!mainBtn) return;

  const timerEl = document.getElementById('workTimer');
  if (timerEl) {
    timerEl.classList.add('timer-swap-out');
    setTimeout(() => {
      timerEl.textContent = 'Done? tap the checkmark';
      timerEl.classList.remove('timer-swap-out');
      timerEl.classList.add('timer-swap-in', 'player-timer-msg');
    }, 180);
  }

  // Replace the main button's click handler for the Done action, and
  // fade the new checkmark state in rather than swapping instantly.
  const newBtn = mainBtn.cloneNode(false);
  newBtn.className = 'player-main-btn done-state fade-in-soft';
  mainBtn.parentNode.replaceChild(newBtn, mainBtn);

  // Icon fades in a beat after the button itself starts appearing
  setTimeout(() => {
    newBtn.innerHTML = iconSvg('check-circle', 30);
  }, 80);

  newBtn.addEventListener('click', () => handleSetDone(step));
}

async function handleSetDone(step) {
  try {
    await api.completeSet(
      workout._id,
      step.entry._id,
      step.entry.exercise._id,
      day,
      step.setNumber
    );
  } catch (err) {
    // Non-fatal to the flow — log and continue so the person isn't blocked
    console.error('Could not save set completion:', err.message);
  }

  planIndex++;

  if (planIndex >= plan.length) {
    goToCompletionScreen();
    return;
  }

  // Same rest timer whether it's the next set of the same exercise or
  // the move into the next exercise — no separate 3-2-1 countdown here.
  // startStep() will still show the 3-2-1 countdown afterward if (and
  // only if) the upcoming step is itself a timed hold.
  renderRestPhase(step);
}

// ===== REST PHASE (between sets of the SAME exercise) =====
// Fixed-length rest regardless of the backend's per-exercise restSeconds
// value, per the latest spec (~25s between sets).
function renderRestPhase(step) {
  currentPhase = 'rest';
  let remaining = REST_SECONDS;

  renderShell(`
    <div class="player-control-section player-center-section">
      <div class="player-rest-label">${iconSvg('leaf', 14)} Rest</div>
      <div class="player-timer" id="restTimer">${formatTime(remaining)}</div>
      <div class="player-rest-ring-wrap">
        <svg viewBox="0 0 100 100" class="player-rest-ring">
          <circle cx="50" cy="50" r="46" class="player-rest-ring-track"></circle>
          <circle cx="50" cy="50" r="46" class="player-rest-ring-fill" id="restRingFill"></circle>
        </svg>
      </div>
      <div class="player-exercise-sub" style="text-align:center;">Next: Set ${step.setNumber + 1} of ${step.entry.sets} — ${step.entry.exercise.name}</div>
    </div>
  `, {
    afterRender: () => {
      const ringFill = document.getElementById('restRingFill');
      const circumference = 2 * Math.PI * 46;
      if (ringFill) {
        ringFill.style.strokeDasharray = `${circumference}`;
        ringFill.style.strokeDashoffset = '0';
      }

      clearInterval(timerInterval);
      timerInterval = setInterval(() => {
        if (holdTimers) return;
        remaining--;
        const el = document.getElementById('restTimer');
        if (remaining >= 0 && el) el.textContent = formatTime(remaining);
        if (ringFill) {
          const progress = Math.max(0, remaining) / REST_SECONDS;
          ringFill.style.strokeDashoffset = `${circumference * (1 - progress)}`;
        }
        if (remaining <= 0) {
          clearInterval(timerInterval);
          startStep();
        }
      }, 1000);
    }
  });
}

async function confirmExit() {
  if (holdTimers) return;
  holdTimers = true;
  const leave = await ui.confirm({
    title: 'Leave this workout?',
    message: 'Sets you have already completed are saved. The set in progress will not count.',
    confirmText: 'Leave',
    cancelText: 'Keep going',
    tone: 'danger'
  });
  if (leave) {
    clearInterval(timerInterval);
    ui.go(`workout-day.html?day=${day}`);
  } else {
    holdTimers = false;
  }
}

function goToCompletionScreen() {
  ui.go(`workout-complete.html?day=${day}`);
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}