

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');


router.get('/me', auth, (req, res) => {
  const user = req.user;
  res.json({ user });
});

module.exports = router;
