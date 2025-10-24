// src/routes/analyticsRoutes.js
const express = require('express')
const router = express.Router()
const auth = require('../middleware/authMiddleware') // protect analytics if needed
const role = require('../middleware/roleMiddleware')
const { getEarnings } = require('../controllers/analyticsController')

// For now, allow admin or authenticated users to fetch (you can restrict)
router.get('/earnings', auth, role('admin'), getEarnings)

module.exports = router
