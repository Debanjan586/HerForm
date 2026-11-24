const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const ActivitySession = require('../models/ActivitySession');
const {
  requireUserAuth,
  requireAdminAuthCookie,
  USER_COOKIE_NAME,
  ADMIN_COOKIE_NAME
} = require('../middleware/auth');

const router = express.Router();

// Brute-force protection: 5 FAILED attempts per 15 minutes per IP, then the
// client gets a 429 with the number of seconds left, so the login page can
// hide the form and show a countdown. Successful logins are not counted.
const LOCK_WINDOW_MS = 15 * 60 * 1000;
const loginLimiter = rateLimit({
  windowMs: LOCK_WINDOW_MS,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const resetTime = req.rateLimit && req.rateLimit.resetTime ? new Date(req.rateLimit.resetTime).getTime() : Date.now() + LOCK_WINDOW_MS;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000));
    res.set('Retry-After', String(retryAfterSeconds));
    res.status(429).json({
      error: 'Too many failed attempts. Login is locked for a while.',
      locked: true,
      retryAfterSeconds
    });
  }
});

// Used to make "unknown email" take as long as "wrong password", so response
// time can't be used to discover which emails have accounts.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// SameSite=None REQUIRES Secure=true, or browsers silently drop the cookie —
// this was causing random logouts on local HTTP. 'lax' works correctly for
// local http://localhost dev; switch to 'none' automatically once
// COOKIE_SECURE=true is set for production HTTPS deployment.
const isSecure = process.env.COOKIE_SECURE === 'true';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: isSecure,
  sameSite: isSecure ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
};

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '7d'
  });
}

function userPayload(user) {
  return {
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    consent: user.consent
  };
}

// POST /api/auth/login  { email, password }
// Shared by both apps — sets the cookie that matches the account's actual
// role, so logging into one app never touches the other's cookie.
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    if (email.length > 200 || password.length > 200) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    const match = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
    if (!user || user.disabled || !match) return res.status(401).json({ error: 'Invalid email or password' });

    const token = signToken(user);
    const cookieName = user.role === 'admin' ? ADMIN_COOKIE_NAME : USER_COOKIE_NAME;
    res.cookie(cookieName, token, COOKIE_OPTS);

    // Start a consent-based activity session (user-side logins only)
    if (user.role === 'user' && user.consent.activityTracking) {
      await ActivitySession.create({ user: user._id });
    }

    res.json({ user: userPayload(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// ---- USER APP: only ever reads the user cookie ----

// GET /api/auth/user/me
router.get('/user/me', requireUserAuth, (req, res) => {
  if (req.user.role !== 'user') {
    return res.status(403).json({ error: 'Not a user account' });
  }
  res.json({ user: userPayload(req.user) });
});

// POST /api/auth/user/logout
router.post('/user/logout', requireUserAuth, async (req, res) => {
  try {
    if (req.user.consent.activityTracking) {
      const session = await ActivitySession.findOne({
        user: req.user._id,
        sessionEndAt: null
      }).sort({ createdAt: -1 });

      if (session) {
        session.sessionEndAt = new Date();
        session.endType = 'confirmed_logout';
        session.estimatedDurationSeconds = Math.round(
          (session.sessionEndAt - session.sessionStartAt) / 1000
        );
        await session.save();
      }
    }

    res.clearCookie(USER_COOKIE_NAME, COOKIE_OPTS);
    res.json({ success: true });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Server error during logout' });
  }
});

// PATCH /api/auth/user/consent
router.patch('/user/consent', requireUserAuth, async (req, res) => {
  try {
    const { activityTracking } = req.body;
    req.user.consent.activityTracking = !!activityTracking;
    req.user.consent.consentUpdatedAt = new Date();
    await req.user.save();
    res.json({ consent: req.user.consent });
  } catch (err) {
    res.status(500).json({ error: 'Could not update consent' });
  }
});

// ---- ADMIN CONSOLE: only ever reads the admin cookie ----

// GET /api/auth/admin/me
router.get('/admin/me', requireAdminAuthCookie, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not an admin account' });
  }
  res.json({ user: userPayload(req.user) });
});

// POST /api/auth/admin/logout
router.post('/admin/logout', requireAdminAuthCookie, async (req, res) => {
  try {
    res.clearCookie(ADMIN_COOKIE_NAME, COOKIE_OPTS);
    res.json({ success: true });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Server error during logout' });
  }
});

module.exports = router;