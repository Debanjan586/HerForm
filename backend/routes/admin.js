const express = require('express');
const User = require('../models/User');
const WorkoutSession = require('../models/WorkoutSession');
const Completion = require('../models/Completion');
const Workout = require('../models/Workout');
const { requireAdminAuthCookie } = require('../middleware/auth');

const router = express.Router();

router.use(requireAdminAuthCookie);

// GET /api/admin/overview
router.get('/overview', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalSessions = await WorkoutSession.countDocuments();
    const completedWorkouts = await WorkoutSession.countDocuments({ fullyCompleted: true });
    const totalCompletions = await Completion.countDocuments();

    // Total possible sets across the whole programme (sum of each day's
    // exercises' set counts), used as the denominator for completion rate.
    const totalSetsInProgram = await Workout.aggregate([
      { $unwind: { path: '$exercises', preserveNullAndEmptyArrays: false } },
      { $group: { _id: null, total: { $sum: '$exercises.sets' } } }
    ]);
    const totalPossible = totalSetsInProgram[0]?.total || 0;
    const completionRate = totalPossible ? Math.round((totalCompletions / totalPossible) * 100) : 0;

    const recentSessions = await WorkoutSession.find({ fullyCompleted: true })
      .sort({ completedAt: -1 })
      .limit(10)
      .populate('user', 'name email')
      .populate('workout', 'title week day');

    res.json({
      totalUsers,
      totalSessions,
      completedWorkouts,
      completionRate,
      recentActivity: recentSessions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch overview' });
  }
});

// GET /api/admin/monitoring — per-user workout progress detail
router.get('/monitoring', async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).select('name email programStartDate');

    const data = await Promise.all(
      users.map(async (user) => {
        const sessions = await WorkoutSession.find({ user: user._id })
          .populate('workout', 'week day title')
          .sort({ day: -1 });

        const latestSession = sessions[0] || null;
        const completedCount = sessions.filter((s) => s.fullyCompleted).length;

        return {
          user: { id: user._id, name: user.name, email: user.email },
          currentWeek: latestSession?.workout?.week || 1,
          currentDay: latestSession?.workout?.day || 1,
          completedWorkouts: completedCount,
          totalSessions: sessions.length,
          sessions: sessions.slice(0, 20)
        };
      })
    );

    res.json({ monitoring: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch monitoring data' });
  }
});

// GET /api/admin/analytics — chart data
router.get('/analytics', async (req, res) => {
  try {
    // Daily activity over last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentSessions = await WorkoutSession.find({
      completedAt: { $gte: thirtyDaysAgo }
    });

    const dailyMap = {};
    recentSessions.forEach((s) => {
      const key = s.completedAt.toISOString().slice(0, 10);
      dailyMap[key] = (dailyMap[key] || 0) + 1;
    });

    const dailyActivity = Object.entries(dailyMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Weekly completion totals (by programme week 1-12)
    const weeklyMap = {};
    const populated = await WorkoutSession.find({ fullyCompleted: true }).populate(
      'workout',
      'week'
    );
    populated.forEach((s) => {
      const wk = s.workout?.week;
      if (wk) weeklyMap[wk] = (weeklyMap[wk] || 0) + 1;
    });
    const weeklyCompletion = Array.from({ length: 12 }, (_, i) => ({
      week: i + 1,
      completed: weeklyMap[i + 1] || 0
    }));

    res.json({ dailyActivity, weeklyCompletion });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not fetch analytics' });
  }
});

module.exports = router;
