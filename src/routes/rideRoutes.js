const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const { requestRide, listRides, getRide, acceptRide, updateRideStatus } = require('../controllers/rideController');

// Rider requests
router.post('/', auth, role('rider'), requestRide);

// Listing (rider/driver/admin)
router.get('/', auth, listRides);
router.get('/:id', auth, getRide);

// Driver actions
router.post('/:id/accept', auth, role('driver'), acceptRide);
router.post('/:id/status', auth, updateRideStatus);

module.exports = router;
