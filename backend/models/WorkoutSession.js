const mongoose = require('mongoose');

// Tracks a full workout-day session: start, completion, timestamps
const WorkoutSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    workout: { type: mongoose.Schema.Types.ObjectId, ref: 'Workout', required: true },
    day: { type: Number, required: true },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    fullyCompleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

WorkoutSessionSchema.index({ user: 1, day: 1 }, { unique: true });

module.exports = mongoose.model('WorkoutSession', WorkoutSessionSchema);
