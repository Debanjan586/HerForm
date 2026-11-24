const mongoose = require('mongoose');

// One record per user+workoutExerciseEntry+set combination. Tracks completion
// through the timer-driven workout player (not a manual checkbox) — a record
// is created when a set's work timer finishes and the user taps Done.
const CompletionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    workout: { type: mongoose.Schema.Types.ObjectId, ref: 'Workout', required: true },
    exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },

    // The _id of the WorkoutExercise subdocument (Workout.exercises[i]._id) —
    // identifies which entry on this specific day this completion belongs to,
    // since the same library exercise could theoretically appear more than once.
    workoutEntryId: { type: mongoose.Schema.Types.ObjectId, required: true },

    day: { type: Number, required: true }, // denormalized for fast queries
    setNumber: { type: Number, required: true, min: 1 }, // which set (1-indexed)

    completed: { type: Boolean, default: true },
    completedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Prevent duplicate completion records for the same user/entry/set
CompletionSchema.index({ user: 1, workoutEntryId: 1, setNumber: 1 }, { unique: true });

module.exports = mongoose.model('Completion', CompletionSchema);
