const express = require('express');
const ActivitySession = require('../models/ActivitySession');
const User = require('../models/User');
const { requireUserAuth, requireAdminAuthCookie } = require('../middleware/auth');

const router = express.Router();

// POST /api/activity/heartbeat — called ~every 30s while the user tab is active
router.post('/heartbeat', requireUserAuth, async (req, res) => {
  try {
    if (!req.user.consent.activityTracking) return res.json({ tracked: false });

    const session = await ActivitySession.findOne({
      user: req.user._id,
      sessionEndAt: null
    }).sort({ createdAt: -1 });

    if (session) {
      session.lastActivityAt = new Date();
      await session.save();
    }

    res.json({ tracked: true });
  } catch (err) {
    res.status(500).json({ error: 'Heartbeat failed' });
  }
});

// POST /api/activity/end — best-effort session end (sent via navigator.sendBeacon on page hide)
router.post('/end', requireUserAuth, async (req, res) => {
  try {
    if (!req.user.consent.activityTracking) return res.json({ tracked: false });

    const session = await ActivitySession.findOne({
      user: req.user._id,
      sessionEndAt: null
    }).sort({ createdAt: -1 });

    if (session) {
      session.sessionEndAt = new Date();
      session.endType = 'confirmed_beacon';
      session.estimatedDurationSeconds = Math.round(
        (session.sessionEndAt - session.sessionStartAt) / 1000
      );
      await session.save();
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not end session' });
  }
});

// GET /api/activity/mine — user reviews their own tracked sessions
router.get('/mine', requireUserAuth, async (req, res) => {
  try {
    const sessions = await ActivitySession.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ sessions, consent: req.user.consent });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch activity' });
  }
});

// ---- ADMIN ----

// GET /api/activity/admin — all consented users' sessions, with date filters
// query: ?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/admin', requireAdminAuthCookie, async (req, res) => {
  try {
    const { from, to } = req.query;
    const filter = {};
    if (from || to) {
      filter.sessionStartAt = {};
      if (from) filter.sessionStartAt.$gte = new Date(from);
      if (to) filter.sessionStartAt.$lte = new Date(to);
    }

    const sessions = await ActivitySession.find(filter)
      .populate('user', 'name email consent')
      .sort({ sessionStartAt: -1 });

    // Only include sessions for users who have consented (defense in depth,
    // since sessions are only ever created when consent was true)
    const consented = sessions.filter((s) => s.user && s.user.consent.activityTracking);

    res.json({ sessions: consented });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch activity' });
  }
});

module.exports = router;
