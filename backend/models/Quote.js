const mongoose = require('mongoose');

// Simple pool of motivational quotes shown on the home screen. Admin can add
// as many as they like; the frontend picks one (e.g. rotate daily or at random).
const QuoteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    author: { type: String, default: '' },
    icon: {
      type: String,
      default: 'sparkles', // lucide icon name, rendered client-side — never an emoji
      trim: true
    },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Quote', QuoteSchema);
