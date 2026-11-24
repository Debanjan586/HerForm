const mongoose = require('mongoose');

// A reusable library exercise. Admin creates these once in "Exercises Library"
// and then picks from them when building each day's workout — nothing here
// is tied to a specific day. Per-day timing overrides live on the Workout's
// exercise-reference subdocument instead (see Workout.js), so the same
// library item (e.g. "Plank") can have different durations on different days.
const ExerciseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },

    // Cloudinary-hosted image — never hardcoded, always admin-uploaded.
    imageUrl: { type: String, default: '' },
    imagePublicId: { type: String, default: '' }, // Cloudinary public_id, for replace/delete

    // Whether this exercise is a timed hold (plank, wall-sit) vs a counted-rep
    // movement (squats, lunges). Timed holds get a pre-hold 3-2-1 countdown
    // in the workout player; rep exercises do not.
    isTimedHold: { type: Boolean, default: false },

    // Defaults — used when a day's workout doesn't override them.
    defaultSets: { type: Number, default: 3, min: 1 },
    defaultReps: { type: String, default: '12' }, // display label, e.g. "12" or "12-15"
    defaultWorkSeconds: { type: Number, default: 30, min: 1 }, // per-set work/hold duration
    defaultRestSeconds: { type: Number, default: 20, min: 0 }, // rest between sets

    instructions: { type: String, default: '' },
    commonMistakes: { type: String, default: '' },
    safetyTips: { type: String, default: '' },

    category: { type: String, default: '', trim: true }, // free-text tag e.g. "Glutes", "Core" — for admin's own organization

    archived: { type: Boolean, default: false } // soft-delete: keeps history intact if removed from library
  },
  { timestamps: true }
);

module.exports = mongoose.model('Exercise', ExerciseSchema);