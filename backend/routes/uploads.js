const express = require('express');
const cloudinary = require('../config/cloudinary');
const { requireAdminAuthCookie } = require('../middleware/auth');

const router = express.Router();

// All upload endpoints are admin-only — this is the only place the API
// secret is ever used, and it never leaves the server.
router.use(requireAdminAuthCookie);

// GET /api/uploads/signature
// Returns a short-lived signature the admin's browser uses to upload a file
// DIRECTLY to Cloudinary (the file bytes never pass through our backend).
// folder is optional — lets us keep exercise images and day-card images tidy.
router.get('/signature', (req, res) => {
  try {
    const folder = (req.query.folder || 'herform').replace(/[^a-zA-Z0-9/_-]/g, '');
    const timestamp = Math.round(Date.now() / 1000);

    const paramsToSign = { timestamp, folder };
    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      signature,
      timestamp,
      folder,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not generate upload signature' });
  }
});

// DELETE /api/uploads/:publicId — remove an image from Cloudinary when an
// admin replaces or removes it, so unused images don't pile up.
// publicId may contain slashes (folder paths), so we accept it as a query param.
router.delete('/', async (req, res) => {
  try {
    const { publicId } = req.body;
    if (!publicId) return res.status(400).json({ error: 'publicId is required' });

    await cloudinary.uploader.destroy(publicId);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not delete image' });
  }
});

module.exports = router;
