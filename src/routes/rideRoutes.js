const express = require("express");
const router = express.Router();
const Ride = require("../models/Ride");

// Create a new ride booking
router.post("/book", async (req, res) => {
  try {
    const { pickup, destination, date, time } = req.body;

    const newRide = new Ride({ pickup, destination, date, time });
    await newRide.save();

    res.status(201).json({ message: "Ride booked successfully", ride: newRide });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
