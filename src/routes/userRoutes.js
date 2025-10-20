// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
  getProfile,
  updateProfile,
  changePassword,
  setAvailability,
  listUsers,
  blockUser,
  unblockUser,
  approveDriver
} = require('../controllers/userController');

router.get('/me', auth, getProfile);
router.put('/me', auth, updateProfile);
router.post('/change-password', auth, changePassword);

// drivers: toggle availability
router.post('/availability', auth, setAvailability);

// admin-only actions
router.get('/', auth, role('admin'), listUsers);
router.post('/:id/block', auth, role('admin'), blockUser);
router.post('/:id/unblock', auth, role('admin'), unblockUser);
router.post('/:id/approve-driver', auth, role('admin'), approveDriver);

module.exports = router;
