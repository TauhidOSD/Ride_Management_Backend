
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  phone: { type: String, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['rider','driver','admin'], default: 'rider' },
  isBlocked: { type: Boolean, default: false },
  isApproved: { type: Boolean, default: false }, // for driver approval by admin
  vehicle: {
    plate: { type: String, default: '' },
    model: { type: String, default: '' },
    color: { type: String, default: '' },
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
