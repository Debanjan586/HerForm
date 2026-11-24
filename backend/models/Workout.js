const mongoose = require('mongoose');

// One subdocument per exercise placed into a day's workout. References a
// library Exercise, but carries its OWN timing — this is what lets the same
// library exercise (e.g. "Plank") have different durations on different days
// without duplicating the exercise itself.
const WorkoutExerciseSchema = new mongoose.Schema(
  {
    exercise: { type: mongoose.Schema.Types.ObjectId, ref: 'Exercise', required: true },
    order: { type: Number, default: 0 },

    // Per-day overrides. If left null/undefined on creation, the admin UI
    // pre-fills from the library exercise's defaults, but these are the
    // values actually used by the workout player for THIS day.
    sets: { type: Number, required: true, min: 1 },
    reps: { type: String, default: '' },
    workSeconds: { type: Number, required: true, min: 1 },
    restSeconds: { type: Number, required: true, min: 0 },

    // Timed holds only (plank, wall-sit): the hold duration of EACH set, in
    // order — e.g. 2 sets of plank => [30, 45]. Length always equals `sets`.
    // Empty for normal rep-based exercises. `workSeconds` mirrors the first
    // value so older code that only reads workSeconds keeps working.
    setTimings: { type: [Number], default: [] }
  },
  { _id: true }
);

const WorkoutSchema = new mongoose.Schema(
  {
    week: { type: Number, required: true, min: 1, max: 12 },
    day: { type: Number, required: true, min: 1, max: 84 }, // absolute day number 1-84
    dayOfWeek: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: true
    },
    title: { type: String, required: true }, // e.g. "Glutes and Thighs" — shown as the day's subject

    // The home-screen day card image (admin-uploaded via Cloudinary),
    // separate from any individual exercise's image.
    cardImageUrl: { type: String, default: '' },
    cardImagePublicId: { type: String, default: '' },

    isRestDay: { type: Boolean, default: false },
    exercises: [WorkoutExerciseSchema],
    enabled: { type: Boolean, default: true }
  },
  { timestamps: true }
);

WorkoutSchema.index({ day: 1 }, { unique: true });

module.exports = mongoose.model('Workout', WorkoutSchema);