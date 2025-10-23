// src/routes/userRoutes.js
const express = require('express')
const router = express.Router()

const auth = require('../middleware/authMiddleware') // ensure this exports (req,res,next) and sets req.user
const role = require('../middleware/roleMiddleware') // role('admin') middleware

const {
  getProfile,
  updateProfile,
  changePassword,
  setAvailability,
  listUsers,
  blockUser,
  unblockUser,
  approveDriver,
} = require('../controllers/userController')

// ====== Authenticated user routes ======
// GET /api/users/me
router.get('/me', auth, getProfile)

// PATCH /api/users/me
router.patch('/me', auth, updateProfile)

// POST /api/users/change-password
router.post('/change-password', auth, changePassword)

// POST /api/users/availability
router.post('/availability', auth, setAvailability)

// ====== Admin-only routes ======
router.get('/', auth, role('admin'), listUsers)
router.post('/:id/block', auth, role('admin'), blockUser)
router.post('/:id/unblock', auth, role('admin'), unblockUser)
router.post('/:id/approve-driver', auth, role('admin'), approveDriver)

module.exports = router
