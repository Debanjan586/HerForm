const express = require('express');
const mongoose = require('mongoose');
const Completion = require('../models/Completion');
const WorkoutSession = require('../models/WorkoutSession');
const Workout = require('../models/Workout');
const { requireUserAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/progress/complete-set — mark one set of one exercise entry complete.
// Called by the workout player when a set's work timer finishes and the user
// taps Done. body: { workoutId, workoutEntryId, exerciseId, day, setNumber }
router.post('/complete-set', requireUserAuth, async (req, res) => {
  try {
    const { workoutId, workoutEntryId, setNumber } = req.body || {};

    if (
      typeof workoutId !== 'string' || !mongoose.isValidObjectId(workoutId) ||
      typeof workoutEntryId !== 'string' || !mongoose.isValidObjectId(workoutEntryId) ||
      !Number.isInteger(setNumber) || setNumber < 1
    ) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    // Everything else comes from the database, not from the client.
    const workout = await Workout.findById(workoutId);
    if (!workout || !workout.enabled || workout.isRestDay) {
      return res.status(404).json({ error: 'Workout not available' });
    }
    const entry = workout.exercises.find((e) => String(e._id) === workoutEntryId);
    if (!entry || setNumber > entry.sets) {
      return res.status(400).json({ error: 'Invalid exercise or set' });
    }
    const day = workout.day;
    const exerciseId = entry.exercise;

    // The day must be unlocked: the previous workout day has to be finished.
    const previousWorkout = await Workout.findOne({
      day: { $lt: day }, isRestDay: false, enabled: true
    }).sort({ day: -1 });
    if (previousWorkout) {
      const prev = await WorkoutSession.findOne({ user: req.user._id, day: previousWorkout.day });
      if (!prev || !prev.fullyCompleted) {
        return res.status(403).json({ error: 'Finish the previous day first' });
      }
    }

    // Ensure a WorkoutSession exists and has a start time
    let session = await WorkoutSession.findOne({ user: req.user._id, day });
    if (!session) {
      session = await WorkoutSession.create({
        user: req.user._id,
        workout: workout._id,
        day,
        startedAt: new Date()
      });
    } else if (!session.startedAt) {
      session.startedAt = new Date();
      await session.save();
    }

    // Prevent duplicate completion records (unique index also enforces this)
    const existing = await Completion.findOne({
      user: req.user._id,
      workoutEntryId,
      setNumber
    });
    if (existing) {
      return res.json({ completion: existing, alreadyCompleted: true });
    }

    const completion = await Completion.create({
      user: req.user._id,
      workout: workout._id,
      exercise: exerciseId,
      workoutEntryId,
      day,
      setNumber,
      completed: true
    });

    // Is the ENTIRE day now complete? Count only sets that belong to this day's
    // current exercise entries.
    const entryIds = workout.exercises.map((e) => String(e._id));
    const totalSetsForDay = workout.exercises.reduce((sum, e) => sum + e.sets, 0);
    const completedSetsForDay = await Completion.countDocuments({
      user: req.user._id,
      day,
      workoutEntryId: { $in: entryIds }
    });

    let dayFullyCompleted = false;
    if (completedSetsForDay >= totalSetsForDay && totalSetsForDay > 0) {
      dayFullyCompleted = true;
      session.fullyCompleted = true;
      session.completedAt = new Date();
      await session.save();
    }

    res.status(201).json({
      completion,
      dayFullyCompleted,
      completedSetsForDay,
      totalSetsForDay
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Set already marked complete' });
    }
    console.error(err);
    res.status(500).json({ error: 'Could not save completion' });
  }
});

// GET /api/progress/day/:day — completion state for a specific day (which
// sets of which exercise entries are done, keyed by workoutEntryId)
router.get('/day/:day', requireUserAuth, async (req, res) => {
  try {
    const dayNum = Number(req.params.day);
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 84) {
      return res.status(400).json({ error: 'Invalid or missing day number' });
    }

    const completions = await Completion.find({ user: req.user._id, day: dayNum });
    const session = await WorkoutSession.findOne({ user: req.user._id, day: dayNum });
    res.json({ completions, session });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch progress' });
  }
});

// GET /api/progress/summary — overall dashboard stats
router.get('/summary', requireUserAuth, async (req, res) => {
  try {
    const sessions = await WorkoutSession.find({ user: req.user._id });
    const totalCompletedWorkouts = sessions.filter((s) => s.fullyCompleted).length;

    const totalWorkoutDays = 72; // 84 days - 12 rest days (1 per week)
    const programProgress = totalWorkoutDays
      ? Math.round((totalCompletedWorkouts / totalWorkoutDays) * 100)
      : 0;

    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const weekSessions = sessions.filter((s) => s.completedAt && s.completedAt >= startOfWeek);

    const calendar = sessions.map((s) => ({
      day: s.day,
      completed: s.fullyCompleted,
      completedAt: s.completedAt
    }));

    res.json({
      totalCompletedWorkouts,
      programProgress,
      weeklyCompletedCount: weekSessions.length,
      calendar
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch summary' });
  }
});

// GET /api/progress/is-day-locked/:day — whether this day is locked (i.e. the
// PREVIOUS workout day hasn't been fully completed yet). Day 1 is never locked.
router.get('/is-day-locked/:day', requireUserAuth, async (req, res) => {
  try {
    const dayNum = Number(req.params.day);
    if (!Number.isInteger(dayNum) || dayNum < 1 || dayNum > 84) {
      return res.status(400).json({ error: 'Invalid day number' });
    }
    if (dayNum === 1) return res.json({ locked: false });

    // Find the most recent enabled, non-rest workout day before this one
    const previousWorkout = await Workout.findOne({
      day: { $lt: dayNum },
      isRestDay: false,
      enabled: true
    }).sort({ day: -1 });

    if (!previousWorkout) return res.json({ locked: false });

    const previousSession = await WorkoutSession.findOne({
      user: req.user._id,
      day: previousWorkout.day
    });

    res.json({ locked: !previousSession || !previousSession.fullyCompleted });
  } catch (err) {
    res.status(500).json({ error: 'Could not check lock status' });
  }
});

module.exports = router;