
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const dotenv = require('dotenv');
dotenv.config();

const validateEmail = (email) => {
  const re = /\S+@\S+\.\S+/;
  return re.test(email);
};

const register = async (req, res) => {
  const { name, email, password, role, phone, vehicle } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required' });
  if (!validateEmail(email)) return res.status(400).json({ message: 'Invalid email' });

  const existing = await User.findOne({ email });
  if (existing) return res.status(400).json({ message: 'Email already registered' });

  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '10', 10);
  const hashed = await bcrypt.hash(password, saltRounds);

  const user = new User({
    name,
    email,
    password: hashed,
    role: role === 'driver' ? 'driver' : 'rider',
    phone,
    vehicle: vehicle || {},
    isApproved: role === 'driver' ? false : true,
  });
  await user.save();

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

  res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, isApproved: user.isApproved } });
};

const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ message: 'Invalid credentials' });

  if (user.isBlocked) return res.status(403).json({ message: 'Account blocked. Contact support.' });

  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

  res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, isApproved: user.isApproved } });
};

module.exports = { register, login };
