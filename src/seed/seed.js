
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const connectDB = require('../config/db');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

(async () => {
  try {
    await connectDB(process.env.MONGO_URI);

    const adminEmail = 'admin@ride.com';
    let admin = await User.findOne({ email: adminEmail });
    if (!admin) {
      const hashed = await bcrypt.hash('Admin@123', parseInt(process.env.BCRYPT_SALT_ROUNDS || '10'));
      admin = await User.create({
        name: 'Admin',
        email: adminEmail,
        password: hashed,
        role: 'admin',
        isApproved: true
      });
      console.log('Admin created:', adminEmail, '/ Admin@123');
    } else {
      console.log('Admin already exists');
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
