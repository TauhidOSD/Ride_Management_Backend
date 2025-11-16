// src/routes/emergencyRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');

// emergency alert test
router.post('/alert', auth, (req, res) => {
  return res.json({
    success: true,
    message: "Emergency alert received",
    user: req.user
  });
});

module.exports = router;
