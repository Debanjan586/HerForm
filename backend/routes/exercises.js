const express = require('express');
const Exercise = require('../models/Exercise');
const Workout = require('../models/Workout');
const { requireAuth, requireAdminAuthCookie } = require('../middleware/auth');

const router = express.Router();

// GET /api/exercises — the full library (used by user app for exercise detail
// lookups, and by admin's Day Builder to pick from)
router.get('/', requireAuth, async (req, res) => {
  try {
    const includeArchived = req.query.includeArchived === 'true';
    const filter = includeArchived ? {} : { archived: false };
    const exercises = await Exercise.find(filter).sort({ category: 1, name: 1 });
    res.json({ exercises });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch exercise library' });
  }
});

// GET /api/exercises/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const exercise = await Exercise.findById(req.params.id);
    if (!exercise) return res.status(404).json({ error: 'Exercise not found' });
    res.json({ exercise });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch exercise' });
  }
});

// ---- ADMIN: library management ----

// POST /api/exercises — create a new library exercise
router.post('/', requireAdminAuthCookie, async (req, res) => {
  try {
    const exercise = await Exercise.create(req.body);
    res.status(201).json({ exercise });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create exercise' });
  }
});

// PATCH /api/exercises/:id — edit a library exercise
router.patch('/:id', requireAdminAuthCookie, async (req, res) => {
  try {
    const exercise = await Exercise.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!exercise) return res.status(404).json({ error: 'Exercise not found' });
    res.json({ exercise });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update exercise' });
  }
});

// DELETE /api/exercises/:id — permanently delete a library exercise and
// remove it from every day that used it
router.delete('/:id', requireAdminAuthCookie, async (req, res) => {
  try {
    const exercise = await Exercise.findByIdAndDelete(req.params.id);
    if (!exercise) return res.status(404).json({ error: 'Exercise not found' });
    await Workout.updateMany({}, { $pull: { exercises: { exercise: exercise._id } } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete exercise' });
  }
});

module.exports = router;