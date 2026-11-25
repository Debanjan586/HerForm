const express = require('express');
const Workout = require('../models/Workout');
const Exercise = require('../models/Exercise');
const { requireUserAuth, requireAdminAuthCookie, requireUserOrAdmin } = require('../middleware/auth');

const router = express.Router();

// ---- helpers for the Day Builder ----

// Per-set hold durations for timed holds. Always returns exactly `sets`
// numbers: uses what the admin gave, repeats the last value for any extra
// sets, and falls back to `fallback` when nothing valid was given.
function normalizeSetTimings(raw, sets, fallback) {
  const given = Array.isArray(raw)
    ? raw.map(Number).filter((n) => Number.isFinite(n) && n > 0).map(Math.round)
    : [];
  const out = [];
  for (let i = 0; i < sets; i++) {
    out.push(given[i] ?? given[given.length - 1] ?? fallback);
  }
  return out;
}

// Builds one day-exercise entry from a library exercise (+ optional overrides).
function buildEntry(libraryExercise, overrides, order) {
  const o = overrides || {};
  const sets = Math.max(1, Number(o.sets ?? libraryExercise.defaultSets) || 1);
  const entry = {
    exercise: libraryExercise._id,
    order,
    sets,
    reps: libraryExercise.isTimedHold ? '' : o.reps ?? libraryExercise.defaultReps,
    workSeconds: o.workSeconds ?? libraryExercise.defaultWorkSeconds,
    restSeconds: o.restSeconds ?? libraryExercise.defaultRestSeconds,
    setTimings: []
  };
  if (libraryExercise.isTimedHold) {
    entry.setTimings = normalizeSetTimings(o.setTimings, sets, entry.workSeconds);
    entry.workSeconds = entry.setTimings[0];
  }
  return entry;
}

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/workouts — full 12-week programme (populated with library exercise details)
router.get('/', requireUserOrAdmin, async (req, res) => {
  try {
    const workouts = await Workout.find().sort({ day: 1 }).populate('exercises.exercise');
    res.json({ workouts });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch workouts' });
  }
});

// GET /api/workouts/day/:day — single day's workout, with exercises populated
router.get('/day/:day', requireUserOrAdmin, async (req, res) => {
  try {
    const dayNum = Number(req.params.day);
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 84) {
      return res.status(400).json({ error: 'Invalid or missing day number' });
    }

    const workout = await Workout.findOne({ day: dayNum }).populate('exercises.exercise');
    if (!workout) return res.status(404).json({ error: 'Workout not found' });
    res.json({ workout });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch workout' });
  }
});

// ---- ADMIN: Day Builder ----

// POST /api/workouts — create/update a workout day's basic info (title, card image, etc.)
// Does NOT touch the exercises list — use the endpoints below for that.
router.post('/', requireAdminAuthCookie, async (req, res) => {
  try {
    const { week, day, dayOfWeek, title, isRestDay, enabled, cardImageUrl, cardImagePublicId } =
      req.body;
    const workout = await Workout.findOneAndUpdate(
      { day },
      { week, day, dayOfWeek, title, isRestDay, enabled, cardImageUrl, cardImagePublicId },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ workout });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save workout' });
  }
});

// PATCH /api/workouts/:id/toggle — enable/disable a workout day
router.patch('/:id/toggle', requireAdminAuthCookie, async (req, res) => {
  try {
    const workout = await Workout.findById(req.params.id);
    if (!workout) return res.status(404).json({ error: 'Workout not found' });
    workout.enabled = !workout.enabled;
    await workout.save();
    res.json({ workout });
  } catch (err) {
    res.status(500).json({ error: 'Could not toggle workout' });
  }
});

// POST /api/workouts/:id/exercises — add a library exercise to this day, with
// per-day timing (sets/reps/workSeconds/restSeconds). If timing fields are
// omitted, falls back to the library exercise's own defaults.
// body: { exerciseId, sets?, reps?, workSeconds?, restSeconds? }
router.post('/:id/exercises', requireAdminAuthCookie, async (req, res) => {
  try {
    const workout = await Workout.findById(req.params.id);
    if (!workout) return res.status(404).json({ error: 'Workout not found' });

    const libraryExercise = await Exercise.findById(req.body.exerciseId);
    if (!libraryExercise) return res.status(404).json({ error: 'Library exercise not found' });

    workout.exercises.push(buildEntry(libraryExercise, req.body, workout.exercises.length));
    await workout.save();
    await workout.populate('exercises.exercise');

    res.status(201).json({ workout });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not add exercise to day' });
  }
});

// POST /api/workouts/:id/exercises/bulk — add many library exercises to this
// day in one go, each with its library defaults (customise afterwards).
// body: { category: "Core" }        -> every non-archived exercise in that
//                                      category that is not already on the day
//    or { exerciseIds: [id, id...] } -> exactly those exercises
router.post('/:id/exercises/bulk', requireAdminAuthCookie, async (req, res) => {
  try {
    const workout = await Workout.findById(req.params.id);
    if (!workout) return res.status(404).json({ error: 'Workout not found' });

    let library = [];
    if (typeof req.body.category === 'string' && req.body.category.trim()) {
      const already = new Set(workout.exercises.map((e) => e.exercise.toString()));
      library = (
        await Exercise.find({
          archived: false,
          category: new RegExp('^' + escapeRegex(req.body.category.trim()) + '$', 'i')
        }).sort({ name: 1 })
      ).filter((ex) => !already.has(ex._id.toString()));
    } else if (Array.isArray(req.body.exerciseIds) && req.body.exerciseIds.length) {
      const found = await Exercise.find({ _id: { $in: req.body.exerciseIds }, archived: false });
      const byId = new Map(found.map((ex) => [ex._id.toString(), ex]));
      // keep the order the admin picked them in
      library = req.body.exerciseIds.map((id) => byId.get(String(id))).filter(Boolean);
    } else {
      return res.status(400).json({ error: 'Send a category or a list of exerciseIds' });
    }

    library.forEach((ex) => {
      workout.exercises.push(buildEntry(ex, null, workout.exercises.length));
    });
    await workout.save();
    await workout.populate('exercises.exercise');

    res.status(201).json({ workout, added: library.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not add exercises to day' });
  }
});

// POST /api/workouts/:id/copy — copy this day's exercises (with their sets,
// reps and per-set timings) onto other days. Saves filling 84 days by hand.
// body: { targetDays: [2, 3, 9], mode: "replace" | "append" }
router.post('/:id/copy', requireAdminAuthCookie, async (req, res) => {
  try {
    const source = await Workout.findById(req.params.id);
    if (!source) return res.status(404).json({ error: 'Workout not found' });

    const targetDays = [...new Set((req.body.targetDays || []).map(Number))].filter(
      (d) => Number.isInteger(d) && d >= 1 && d <= 84 && d !== source.day
    );
    if (targetDays.length === 0) return res.status(400).json({ error: 'Pick at least one other day' });
    const append = req.body.mode === 'append';

    const targets = await Workout.find({ day: { $in: targetDays } });
    for (const target of targets) {
      const base = append ? target.exercises.length : 0;
      const copies = source.exercises.map((e, i) => ({
        exercise: e.exercise,
        order: base + i,
        sets: e.sets,
        reps: e.reps,
        workSeconds: e.workSeconds,
        restSeconds: e.restSeconds,
        setTimings: [...(e.setTimings || [])]
      }));
      target.exercises = append ? [...target.exercises, ...copies] : copies;
      await target.save();
    }

    res.json({ copied: targets.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not copy day' });
  }
});

// PATCH /api/workouts/:id/exercises/:entryId — edit a day's per-exercise timing
// (entryId is the WorkoutExercise subdocument's _id, not the library exercise's id)
router.patch('/:id/exercises/:entryId', requireAdminAuthCookie, async (req, res) => {
  try {
    const workout = await Workout.findById(req.params.id);
    if (!workout) return res.status(404).json({ error: 'Workout not found' });

    const entry = workout.exercises.id(req.params.entryId);
    if (!entry) return res.status(404).json({ error: 'Exercise entry not found on this day' });

    ['sets', 'reps', 'workSeconds', 'restSeconds'].forEach((field) => {
      if (req.body[field] !== undefined) entry[field] = req.body[field];
    });

    // Timed holds keep one duration per set; keep that list in step with `sets`.
    const library = await Exercise.findById(entry.exercise);
    if (library && library.isTimedHold) {
      const source = req.body.setTimings !== undefined ? req.body.setTimings : entry.setTimings;
      entry.setTimings = normalizeSetTimings(source, entry.sets, entry.workSeconds);
      entry.workSeconds = entry.setTimings[0];
      entry.reps = '';
    }

    await workout.save();
    await workout.populate('exercises.exercise');
    res.json({ workout });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update exercise timing' });
  }
});

// DELETE /api/workouts/:id/exercises/:entryId — remove an exercise from this day
router.delete('/:id/exercises/:entryId', requireAdminAuthCookie, async (req, res) => {
  try {
    const workout = await Workout.findById(req.params.id);
    if (!workout) return res.status(404).json({ error: 'Workout not found' });

    workout.exercises = workout.exercises.filter(
      (e) => e._id.toString() !== req.params.entryId
    );
    await workout.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not remove exercise from day' });
  }
});

// PATCH /api/workouts/:id/reorder — reorder exercises within a day
// body: { entryIds: [entryId1, entryId2, ...] } in new order
router.patch('/:id/reorder', requireAdminAuthCookie, async (req, res) => {
  try {
    const { entryIds } = req.body;
    const workout = await Workout.findById(req.params.id);
    if (!workout) return res.status(404).json({ error: 'Workout not found' });

    const byId = {};
    workout.exercises.forEach((e) => (byId[e._id.toString()] = e));

    workout.exercises = entryIds.map((id, idx) => {
      const entry = byId[id];
      entry.order = idx;
      return entry;
    });

    await workout.save();
    await workout.populate('exercises.exercise');
    res.json({ workout });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not reorder exercises' });
  }
});

module.exports = router;