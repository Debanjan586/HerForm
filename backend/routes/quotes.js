const express = require('express');
const Quote = require('../models/Quote');
const { requireUserAuth, requireAdminAuthCookie } = require('../middleware/auth');

const router = express.Router();

// GET /api/quotes/today — one quote for the home screen, picked deterministically
// by date so it stays the same all day but rotates daily.
router.get('/today', requireUserAuth, async (req, res) => {
  try {
    const quotes = await Quote.find({ active: true });
    if (quotes.length === 0) return res.json({ quote: null });

    const dayIndex = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    const quote = quotes[dayIndex % quotes.length];
    res.json({ quote });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch quote' });
  }
});

// GET /api/quotes — admin: full list for management
router.get('/', requireAdminAuthCookie, async (req, res) => {
  try {
    const quotes = await Quote.find().sort({ createdAt: -1 });
    res.json({ quotes });
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch quotes' });
  }
});

// POST /api/quotes — admin: add a quote
router.post('/', requireAdminAuthCookie, async (req, res) => {
  try {
    const quote = await Quote.create(req.body);
    res.status(201).json({ quote });
  } catch (err) {
    res.status(500).json({ error: 'Could not create quote' });
  }
});

// PATCH /api/quotes/:id — admin: edit a quote
router.patch('/:id', requireAdminAuthCookie, async (req, res) => {
  try {
    const quote = await Quote.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!quote) return res.status(404).json({ error: 'Quote not found' });
    res.json({ quote });
  } catch (err) {
    res.status(500).json({ error: 'Could not update quote' });
  }
});

// DELETE /api/quotes/:id — admin: remove a quote
router.delete('/:id', requireAdminAuthCookie, async (req, res) => {
  try {
    await Quote.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete quote' });
  }
});

module.exports = router;
