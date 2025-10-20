const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

async function socketAuth(socket, next) {
  try {
    // token can come as auth token in query or in headers depending on client
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      const err = new Error('Unauthorized: token missing');
      err.data = { content: 'Please send token for socket auth' };
      return next(err);
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      const err = new Error('Unauthorized: user not found');
      return next(err);
    }
    if (user.isBlocked) {
      const err = new Error('Forbidden: account blocked');
      return next(err);
    }
    // attach user to socket
    socket.user = user;
    return next();
  } catch (err) {
    console.log('Socket auth error', err.message);
    return next(new Error('Unauthorized'));
  }
}

module.exports = socketAuth;
