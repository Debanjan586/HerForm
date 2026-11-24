const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: 'Her' },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },

    // Admin can switch an account off without deleting its progress
    disabled: { type: Boolean, default: false },

    // Programme tracking
    programStartDate: { type: Date, default: Date.now },

    // Profile / preferences
    preferences: {
      notifications: { type: Boolean, default: true },
      reminderTime: { type: String, default: '07:00' }
    },

    // Privacy / consent — activity tracking is OFF until explicitly accepted
    consent: {
      activityTracking: { type: Boolean, default: false },
      consentUpdatedAt: { type: Date, default: null }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);