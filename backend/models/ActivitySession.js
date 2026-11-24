const mongoose = require('mongoose');

// Consent-based session analytics. Only created when user.consent.activityTracking === true.
const ActivitySessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    loginAt: { type: Date, default: Date.now },
    sessionStartAt: { type: Date, default: Date.now },
    lastActivityAt: { type: Date, default: Date.now },
    sessionEndAt: { type: Date, default: null }, // only set on a confirmed end (logout / beacon)
    endType: {
      type: String,
      enum: ['confirmed_logout', 'confirmed_beacon', 'estimated_timeout', null],
      default: null
    },
    // Estimated duration in seconds. Always derived, never presented as exact unless endType is confirmed_*
    estimatedDurationSeconds: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ActivitySession', ActivitySessionSchema);
