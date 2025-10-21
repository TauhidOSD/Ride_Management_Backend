// src/socket.js
const { Server } = require('socket.io');
const socketAuth = require('./utils/socketAuth');
const Ride = require('./models/rideModel');
const User = require('./models/User');

function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: '*', // dev only: change to frontend origin in production
      methods: ['GET','POST'],
    }
  });

  // middleware for auth
  io.use(async (socket, next) => {
    await socketAuth(socket, next);
  });

  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`Socket connected: ${socket.id} user: ${user.email} role: ${user.role}`);

    // join personal room for direct messages
    socket.join(`user:${user._id}`);

    // if driver, optionally join drivers room (global) or location-specific rooms later
    if (user.role === 'driver') {
      socket.join('drivers');
      console.log(`Driver ${user._id} joined drivers room`);
      // mark driver online
      User.findByIdAndUpdate(user._id, { isOnline: true }).catch(err => console.error(err));
    }

    // handle driver toggling offline
    socket.on('driver:offline', async () => {
      if (user.role === 'driver') {
        socket.leave('drivers');
        await User.findByIdAndUpdate(user._id, { isOnline: false });
        io.to(`user:${user._id}`).emit('driver:status', { isOnline: false });
      }
    });

    // rider requests a ride via socket (optional — also possible via REST)
    socket.on('ride:request', async (payload, ack) => {
      try {
        // payload expected: { pickup, destination, fare, paymentMethod }
        const ride = new Ride({
          rider: user._id,
          pickup: payload.pickup,
          destination: payload.destination,
          fare: payload.fare || 0,
          paymentMethod: payload.paymentMethod || 'cash',
          status: 'requested',
        });
        await ride.save();

        // emit to drivers room: new ride (in a real app filter by location)
        io.to('drivers').emit('ride:new', {
          rideId: ride._id,
          pickup: ride.pickup,
          destination: ride.destination,
          fare: ride.fare,
          createdAt: ride.createdAt,
        });

        // ack back to rider
        if (typeof ack === 'function') ack({ ok: true, rideId: ride._id });
      } catch (err) {
        console.error('ride:request error', err);
        if (typeof ack === 'function') ack({ ok: false, message: err.message });
      }
    });

    // driver accepts via socket
    socket.on('ride:accept', async ({ rideId }, ack) => {
      try {
        const ride = await Ride.findById(rideId);
        if (!ride) return ack?.({ ok: false, message: 'Ride not found' });
        if (ride.driver && ride.driver.toString() !== user._id.toString()) {
          return ack?.({ ok: false, message: 'Already assigned' });
        }

        // check driver approval & online (we assume user is driver)
        const driver = await User.findById(user._id);
        if (!driver.isApproved) return ack?.({ ok: false, message: 'Driver not approved' });
        if (!driver.isOnline) return ack?.({ ok: false, message: 'Driver offline' });

        ride.driver = user._id;
        ride.status = 'accepted';
        await ride.save();

        // notify rider via their room
        io.to(`user:${ride.rider}`).emit('ride:accepted', {
          rideId: ride._id,
          driver: {
            id: driver._id,
            name: driver.name,
            phone: driver.phone,
            vehicle: driver.vehicle
          },
          status: ride.status
        });

        // optionally notify other drivers to ignore this one
        io.to('drivers').emit('ride:removed', { rideId: ride._id });

        ack?.({ ok: true, rideId: ride._id, driverId: driver._id });
      } catch (err) {
        console.error('ride:accept error', err);
        ack?.({ ok: false, message: err.message });
      }
    });

    // driver/rider update ride status
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

        ack?.({ ok:true });
      } catch (err) {
        console.error('ride:status error', err);
        ack?.({ ok:false, message: err.message });
      }
    });

    // handle disconnect
    socket.on('disconnect', async (reason) => {
      console.log(`Socket disconnected: ${socket.id} reason: ${reason}`);
      if (user.role === 'driver') {
        // set offline in DB
        await User.findByIdAndUpdate(user._id, { isOnline: false }).catch(()=>{});
        // broadcast driver offline if needed
        io.to('drivers').emit('driver:offline', { driverId: user._id });
      }
    });
  });

  // expose io if needed
  return io;
}

module.exports = { setupSocket };
