require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const workoutRoutes = require('./routes/workouts');
const progressRoutes = require('./routes/progress');
const activityRoutes = require('./routes/activity');
const adminRoutes = require('./routes/admin');
const exerciseRoutes = require('./routes/exercises');
const quoteRoutes = require('./routes/quotes');
const uploadRoutes = require('./routes/uploads');
const userRoutes = require('./routes/users');

const app = express();

// Render (and most hosts) sit behind a reverse proxy. Without this, every
// visitor appears to come from the proxy's IP, so the login rate limiter
// would lock EVERYONE out after one person's failed attempts.
app.set('trust proxy', 1);
app.disable('x-powered-by');

connectDB();

// --- Security & core middleware ---
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim());

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        // Log clearly so local setup issues are easy to spot — add this
        // origin to CORS_ORIGINS in .env if it's one you expect to use.
        console.warn(
          `CORS blocked request from origin "${origin}". Allowed origins: ${allowedOrigins.join(', ') || '(none configured)'}`
        );
        callback(null, false);
      }
    },
    credentials: true
  })
);

// Security headers (run `npm install helmet`; skipped quietly if missing)
const helmet = require('helmet');

app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    }
  })
);

// Extra CSRF guard: a browser always sends Origin on cross-site writes.
// Reject state-changing requests that come from an origin we don't trust.
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Global rate limiter — generous, just a safety net
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500
});
app.use(globalLimiter);

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// --- Error handler (catches CORS errors and anything unhandled) ---
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`HERFORM API running on port ${PORT}`));