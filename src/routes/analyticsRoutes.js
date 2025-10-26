const express = require('express')
const router = express.Router()
const auth = require('../middleware/authMiddleware') // 
const role = require('../middleware/roleMiddleware')
const { getEarnings, getSummary } = require('../controllers/analyticsController')


router.get('/earnings', auth, getEarnings)

// router.get('/earnings', auth, role('admin'), getEarnings)
router.get('/summary', auth, role('admin'), getSummary)



module.exports = router
