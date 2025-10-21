// src/routes/rideRoutes.js
const express = require('express');
const router = express.Router();
const Ride = require('../models/rideModel'); 

// GET /api/rides
router.get('/', async (req, res) => {
  try {
    const rides = await Ride.find().sort({ createdAt: -1 });
    return res.json(rides); // send array
  } catch (err) {
    console.error('GET /api/rides error:', err);
    return res.status(500).json({ message: err.message || 'Server error' });
  }
});

// POST /api/rides/book (optional)
router.post('/book', async (req, res) => {
  try {
    const { pickup, destination, fare } = req.body;
    if (!pickup?.address || !destination?.address) return res.status(400).json({ message: 'Pickup & destination required' });
    const ride = new Ride({ pickup, destination, fare });
    await ride.save();
    return res.status(201).json({ ride });
  } catch (err) {
    console.error('POST /api/rides/book error:', err);
    return res.status(500).json({ message: err.message || 'Server error' });
  }
});

module.exports = router;
