
const User = require('../models/User');
const bcrypt = require('bcryptjs');

const getProfile = async (req, res) => {
  const user = req.user;
  res.json({ user });
};

const updateProfile = async (req, res) => {
  const user = req.user;
  const { name, phone, vehicle, emergencyContacts } = req.body;
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (vehicle) user.vehicle = { ...user.vehicle, ...vehicle };
  if (Array.isArray(emergencyContacts)) user.emergencyContacts = emergencyContacts;
  await user.save();
  res.json({ user });
};

const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ message: 'Old and new password required' });

  const user = await User.findById(req.user._id);
  const match = await bcrypt.compare(oldPassword, user.password);
  if (!match) return res.status(400).json({ message: 'Old password incorrect' });

  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
  user.password = await bcrypt.hash(newPassword, saltRounds);
  await user.save();
  res.json({ message: 'Password updated' });
};

// Toggle driver availability (online/offline)
const setAvailability = async (req, res) => {
  if (req.user.role !== 'driver') return res.status(403).json({ message: 'Only drivers can set availability' });
  const { isOnline } = req.body;
  req.user.isOnline = Boolean(isOnline);
  await req.user.save();
  res.json({ message: 'Availability updated', isOnline: req.user.isOnline });
};

// Admin actions
const listUsers = async (req, res) => {
  const { role, q, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (q) filter.$or = [
    { name: { $regex: q, $options: 'i' } },
    { email: { $regex: q, $options: 'i' } }
  ];
  const users = await User.find(filter).skip((page-1)*limit).limit(Number(limit)).sort({ createdAt: -1 });
  res.json({ users });
};

const blockUser = async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  user.isBlocked = true;
  await user.save();
  res.json({ message: 'User blocked' });
};

const unblockUser = async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  user.isBlocked = false;
  await user.save();
  res.json({ message: 'User unblocked' });
};

const approveDriver = async (req, res) => {
  const { id } = req.params;
  const user = await User.findById(id);
  if (!user || user.role !== 'driver') return res.status(404).json({ message: 'Driver not found' });
  user.isApproved = true;
  await user.save();
  res.json({ message: 'Driver approved' });
};

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  setAvailability,
  listUsers,
  blockUser,
  unblockUser,
  approveDriver
};
