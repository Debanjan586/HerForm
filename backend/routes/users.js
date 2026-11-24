const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const WorkoutSession = require('../models/WorkoutSession');
const Completion = require('../models/Completion');
const ActivitySession = require('../models/ActivitySession');
const { requireAdminAuthCookie } = require('../middleware/auth');

const router = express.Router();

// Everything here is admin-only, and only ever touches role "user" accounts —
// admin accounts can't be edited or deleted through this API.
router.use(requireAdminAuthCookie);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(u, completedDays) {
  return {
    _id: u._id,
    name: u.name,
    email: u.email,
    disabled: !!u.disabled,
    createdAt: u.createdAt,
    completedDays: completedDays || 0
  };
}

function cleanName(v) {
  return typeof v === 'string' ? v.trim().slice(0, 80) : '';
}

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).sort({ createdAt: -1 });
    const counts = await WorkoutSession.aggregate([
      { $match: { fullyCompleted: true, user: { $in: users.map((u) => u._id) } } },
      { $group: { _id: '$user', n: { $sum: 1 } } }
    ]);
    const byUser = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
    res.json({ users: users.map((u) => publicUser(u, byUser[String(u._id)])) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch users' });
  }
});

// POST /api/users  { name, email, password }
router.post('/', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ error: 'Enter a valid email' });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 100) {
      return res.status(400).json({ error: 'Password must be 8 to 100 characters' });
    }
    const clean = email.toLowerCase().trim();
    if (await User.findOne({ email: clean })) {
      return res.status(409).json({ error: 'That email already has an account' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email: clean, passwordHash, name: cleanName(name) || 'Member', role: 'user' });
    res.status(201).json({ user: publicUser(user, 0) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not create user' });
  }
});

// PATCH /api/users/:id  { name?, email?, password?, disabled? }
router.patch('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const user = await User.findOne({ _id: req.params.id, role: 'user' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { name, email, password, disabled } = req.body || {};

    if (name !== undefined) user.name = cleanName(name) || user.name;

    if (email !== undefined) {
      if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
        return res.status(400).json({ error: 'Enter a valid email' });
      }
      const clean = email.toLowerCase().trim();
      if (clean !== user.email) {
        if (await User.findOne({ email: clean })) return res.status(409).json({ error: 'That email already has an account' });
        user.email = clean;
      }
    }

    if (password) {
      if (typeof password !== 'string' || password.length < 8 || password.length > 100) {
        return res.status(400).json({ error: 'Password must be 8 to 100 characters' });
      }
      user.passwordHash = await bcrypt.hash(password, 12);
    }

    if (typeof disabled === 'boolean') user.disabled = disabled;

    await user.save();
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not update user' });
  }
});

// DELETE /api/users/:id — removes the account AND all of its progress
router.delete('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const user = await User.findOne({ _id: req.params.id, role: 'user' });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await Promise.all([
      Completion.deleteMany({ user: user._id }),
      WorkoutSession.deleteMany({ user: user._id }),
      ActivitySession.deleteMany({ user: user._id })
    ]);
    await user.deleteOne();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete user' });
  }
});

module.exports = router;