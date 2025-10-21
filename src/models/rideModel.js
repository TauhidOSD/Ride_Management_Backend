
const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  pickup: {
    address: { type: String, required: true },
    lat: Number,
    lng: Number
  },
  destination: {
    address: { type: String, required: true },
    lat: Number,
    lng: Number
  },
  fare: { type: Number, default: 0 },
  status: { type: String, default: 'requested' },
}, { timestamps: true });

module.exports = mongoose.model('Ride', rideSchema);
