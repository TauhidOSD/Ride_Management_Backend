
const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  rider: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  pickup: {
    address: { type: String, required: true },
    lat: Number,
    lng: Number,
  },
  destination: {
    address: { type: String, required: true },
    lat: Number,
    lng: Number,
  },
  fare: { type: Number, default: 0 },
  status: { 
    type: String, 
    enum: ['requested','matched','accepted','picked_up','in_transit','completed','cancelled'],
    default: 'requested'
  },
  paymentMethod: { type: String, enum: ['cash','card','wallet'], default: 'cash' },
}, { timestamps: true });

module.exports = mongoose.model('Ride', rideSchema);
