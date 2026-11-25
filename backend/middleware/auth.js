const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Separate cookie names for the user app and the admin console. Without
// this, logging into one on the same host (even on a different port, like
// localhost:3000 vs localhost:3001) overwrites the other's cookie, since
// browsers scope cookies by domain, not by port — logging into admin would
// silently log the user app out, and vice versa.
const USER_COOKIE_NAME = 'herform_user_token';
const ADMIN_COOKIE_NAME = 'herform_admin_token';

// Shared verification logic — looks up the user from whichever token was
// found and attaches req.user, or responds 401.
async function verifyAndAttach(token, req, res, next, requiredRole) {
  try {
    if (!token) return res.status(401).json({ error: 'Not authenticated' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user || user.disabled) return res.status(401).json({ error: 'User not found' });

    // The cookie name alone proves nothing (a user can rename cookies in their
    // own browser), so the role stored in the database must match too.
    if (requiredRole && user.role !== requiredRole) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// IMPORTANT: this reads BOTH cookies and picks whichever is present. That is
// only safe for routes that are genuinely shared between the user app and
// the admin console AND don't care which one is calling (there currently
// are none that need this — every route is used by exactly one app). Routes
// should instead use requireUserAuth or requireAdminAuthCookie below, which
// each look at exactly one cookie, so a browser that happens to be logged
// into both apps at once is authenticated as whichever app is actually
// making the request — not as whichever cookie happens to exist first.
async function requireAuth(req, res, next) {
  const token = req.cookies[USER_COOKIE_NAME] || req.cookies[ADMIN_COOKIE_NAME];
  return verifyAndAttach(token, req, res, next);
}

// Use this for every route that belongs to the USER app.
async function requireUserAuth(req, res, next) {
  const token = req.cookies[USER_COOKIE_NAME];
  return verifyAndAttach(token, req, res, next, 'user');
}

// Use this for every route that belongs to the ADMIN console. Distinct from
// requireAdmin below (which checks role AFTER auth) — this one decides which
// COOKIE to trust in the first place.
async function requireAdminAuthCookie(req, res, next) {
  const token = req.cookies[ADMIN_COOKIE_NAME];
  return verifyAndAttach(token, req, res, next, 'admin');
}

// For read-only routes used by BOTH apps (e.g. listing workouts): accepts a
// valid user cookie (role user) or a valid admin cookie (role admin).
async function requireUserOrAdmin(req, res, next) {
  if (req.cookies[USER_COOKIE_NAME]) return verifyAndAttach(req.cookies[USER_COOKIE_NAME], req, res, next, 'user');
  return verifyAndAttach(req.cookies[ADMIN_COOKIE_NAME], req, res, next, 'admin');
}

// Requires req.user.role === 'admin' (use AFTER requireAuth)
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = {
  requireAuth,
  requireUserAuth,
  requireAdminAuthCookie,
  requireUserOrAdmin,
  requireAdmin,
  USER_COOKIE_NAME,
  ADMIN_COOKIE_NAME
};