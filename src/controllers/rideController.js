
const Ride = require('../models/rideModel');
const User = require('../models/User');

const requestRide = async (req, res) => {
  const { pickup, destination, fare, paymentMethod } = req.body;
  if (!pickup || !pickup.address || !destination || !destination.address) {
    return res.status(400).json({ message: 'Pickup and destination address required' });
  }
  const ride = new Ride({
    rider: req.user._id,
    pickup,
    destination,
    fare: fare || 0,
    paymentMethod: paymentMethod || 'cash',
    status: 'requested',
  });
  await ride.save();
  // TODO: notify nearby drivers via Socket/Push in future step
  res.status(201).json({ ride });
};

const listRides = async (req, res) => {
  const { page = 1, limit = 20, status, q } = req.query;
  const filter = {};
  if (req.user.role === 'rider') filter.rider = req.user._id;
  if (req.user.role === 'driver') filter.driver = req.user._id;
  if (status) filter.status = status;
  if (q) filter.$or = [
    { 'pickup.address': { $regex: q, $options: 'i' } },
    { 'destination.address': { $regex: q, $options: 'i' } }
  ];
  const rides = await Ride.find(filter)
    .populate('rider', 'name email phone')
    .populate('driver', 'name email phone vehicle')
    .skip((page-1)*limit)
    .limit(Number(limit))
    .sort({ createdAt: -1 });
  res.json({ rides });
};

const getRide = async (req, res) => {
  const ride = await Ride.findById(req.params.id)
    .populate('rider', 'name email phone')
    .populate('driver', 'name email phone vehicle');
  if (!ride) return res.status(404).json({ message: 'Ride not found' });

  // Check access
  if (req.user.role === 'rider' && ride.rider._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  if (req.user.role === 'driver' && ride.driver && ride.driver._id.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  res.json({ ride });
};

// Driver accepts ride
const acceptRide = async (req, res) => {
  const ride = await Ride.findById(req.params.id);
  if (!ride) return res.status(404).json({ message: 'Ride not found' });

  if (ride.driver && ride.driver.toString() !== req.user._id.toString()) {
    return res.status(400).json({ message: 'Already assigned' });
  }

  // driver must be approved and online
  const driver = await User.findById(req.user._id);
  if (!driver.isApproved) return res.status(403).json({ message: 'Driver not approved' });
  if (!driver.isOnline) return res.status(403).json({ message: 'Driver is offline' });

  ride.driver = req.user._id;
  ride.status = 'accepted';
  await ride.save();

  // TODO: emit realtime event to rider that driver accepted
  res.json({ ride });
};

const updateRideStatus = async (req, res) => {
  const { status } = req.body;
  const ride = await Ride.findById(req.params.id);
  if (!ride) return res.status(404).json({ message: 'Ride not found' });

  // Allowed transitions — you can expand/validate transitions more strictly
  const allowed = ['accepted','picked_up','in_transit','completed','cancelled'];
  if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });

  // Only driver assigned or admin can update to these statuses (except cancel maybe by rider)
  if (req.user.role === 'driver') {
    if (!ride.driver || ride.driver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only assigned driver can update status' });
    }
  } else if (req.user.role === 'rider') {
    // rider can cancel if still requested/matched maybe
    if (status !== 'cancelled') return res.status(403).json({ message: 'Rider cannot set this status' });
    if (ride.rider.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Forbidden' });
  }
  ride.status = status;
  ride.updatedAt = new Date();
  await ride.save();
  res.json({ ride });
};

module.exports = { requestRide, listRides, getRide, acceptRide, updateRideStatus };
