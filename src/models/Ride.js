const mongoose = require("mongoose");

const rideSchema = new mongoose.Schema({
  pickup: { type: String, required: true },
  destination: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model("Ride", rideSchema);
