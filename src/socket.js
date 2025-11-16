// src/socket.js
const { Server } = require('socket.io');
const socketAuth = require('./utils/socketAuth'); // must set socket.user
const Ride = require('./models/rideModel');
const User = require('./models/User');

let io = null;

function initSocket(server) {
  if (io) return io; // avoid multiple inits

  io = new Server(server, {
    cors: {
      origin: '*', // dev only — production: set frontend origin
      methods: ['GET', 'POST'],
    },
  });

  // middleware for auth — expects socketAuth to set socket.user
  io.use(async (socket, next) => {
    try {
      await socketAuth(socket, next);
    } catch (err) {
      console.error('socket auth error', err);
      return next(err);
    }
  });

  io.on('connection', (socket) => {
    const user = socket.user || {};
    console.log(`Socket connected: ${socket.id} user: ${user.email ?? 'unknown'} role: ${user.role ?? 'unknown'}`);

    // join personal room for direct messages
    if (user._id) socket.join(`user:${user._id}`);

    // if driver, join drivers room and mark online
    if (user.role === 'driver' && user._id) {
      socket.join('drivers');
      console.log(`Driver ${user._id} joined drivers room`);
      User.findByIdAndUpdate(user._id, { isOnline: true }).catch(err => console.error('set driver online err', err));
    }

    // handle driver toggling offline
    socket.on('driver:offline', async () => {
      if (user.role === 'driver' && user._id) {
        socket.leave('drivers');
        await User.findByIdAndUpdate(user._id, { isOnline: false }).catch(()=>{});
        io.to(`user:${user._id}`).emit('driver:status', { isOnline: false });
      }
    });

    // Rider -> request ride (create in DB and notify drivers)
    socket.on('ride:request', async (payload, ack) => {
      try {
        const ride = new Ride({
          rider: user._id,
          pickup: payload.pickup,
          destination: payload.destination,
          fare: payload.fare || 0,
          paymentMethod: payload.paymentMethod || 'cash',
          status: 'requested',
        });
        await ride.save();

        // emit to drivers (or better: to drivers in area)
        io.to('drivers').emit('ride:new', {
          rideId: ride._id,
          pickup: ride.pickup,
          destination: ride.destination,
          fare: ride.fare,
          createdAt: ride.createdAt,
        });

        if (typeof ack === 'function') ack({ ok: true, rideId: ride._id });
      } catch (err) {
        console.error('ride:request error', err);
        if (typeof ack === 'function') ack({ ok: false, message: err.message });
      }
    });

    // Driver accepts via socket
    socket.on('ride:accept', async ({ rideId, driverId }, ack) => {
      try {
        if (!rideId) return ack?.({ ok: false, message: 'rideId required' });

        const ride = await Ride.findById(rideId);
        if (!ride) return ack?.({ ok: false, message: 'Ride not found' });

        // lock check: if already assigned and not this driver
        if (ride.driver && ride.driver.toString() !== (driverId || user._id).toString()) {
          return ack?.({ ok: false, message: 'Already assigned' });
        }

        // set driver & status
        ride.driver = driverId || user._id;
        ride.status = 'accepted';
        await ride.save();

        // Notify rider specifically
        io.to(`user:${ride.rider}`).emit('ride:accepted', {
          rideId: ride._id,
          driver: {
            id: ride.driver,
            // optionally fetch driver details if needed
          },
          status: ride.status
        });

        // Notify other drivers to remove
        io.to('drivers').emit('ride:removed', { rideId: ride._id });

        if (typeof ack === 'function') ack({ ok: true, rideId: ride._id, driverId: ride.driver });
      } catch (err) {
        console.error('ride:accept error', err);
        if (typeof ack === 'function') ack({ ok: false, message: err.message });
      }
    });

    // Driver/rider update ride status (PATCH style via socket)
    socket.on('ride:status', async ({ rideId, status }, ack) => {
      try {
        const ride = await Ride.findById(rideId);
        if (!ride) return ack?.({ ok:false, message:'Ride not found' });

        // permission checks
        if (socket.user.role === 'driver') {
          if (!ride.driver || ride.driver.toString() !== socket.user._id.toString()) {
            return ack?.({ ok:false, message:'Not allowed' });
          }
        } else if (socket.user.role === 'rider') {
          if (ride.rider.toString() !== socket.user._id.toString()) {
            return ack?.({ ok:false, message:'Not allowed' });
          }
        }

        ride.status = status;
        await ride.save();

        // notify rider and driver rooms
        io.to(`user:${ride.rider}`).emit('ride:statusUpdated', { rideId: ride._id, status });
        if (ride.driver) io.to(`user:${ride.driver}`).emit('ride:statusUpdated', { rideId: ride._id, status });

        if (typeof ack === 'function') ack({ ok:true });
      } catch (err) {
        console.error('ride:status error', err);
        if (typeof ack === 'function') ack({ ok:false, message: err.message });
      }
    });

    // Driver -> share live location
    socket.on('driver:location', async (payload) => {
      try {
        // payload should include rideId, lat, lng, optionally riderId
        const { rideId, lat, lng, speed, heading, riderId } = payload || {};
        if (!rideId) return;

        // optional: find ride to get riderId if not provided
        let targetRiderId = riderId;
        if (!targetRiderId) {
          const ride = await Ride.findById(rideId).select('rider driver');
          if (ride) targetRiderId = ride.rider;
        }
        if (!targetRiderId) return;

        io.to(`user:${targetRiderId}`).emit('driver:location', {
          rideId,
          lat,
          lng,
          speed: speed ?? null,
          heading: heading ?? null,
          ts: Date.now(),
        });
      } catch (err) {
        console.error('driver:location handler error', err);
      }
    });

    // clean up on disconnect
    socket.on('disconnect', async (reason) => {
      console.log(`Socket disconnected: ${socket.id} reason: ${reason}`);
      if (user.role === 'driver' && user._id) {
        await User.findByIdAndUpdate(user._id, { isOnline: false }).catch(()=>{});
        io.to('drivers').emit('driver:offline', { driverId: user._id });
      }
    });
  });

  return io;
}

module.exports = { initSocket, getIo: () => io };
