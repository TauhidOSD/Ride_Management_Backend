const Ride = require('../models/rideModel')


async function getEarnings(req, res) {
  try {
    const range = (req.query.range || 'monthly').toLowerCase()
    const driverId = req.query.driverId
    // pipeline grouping format by range
    let dateTruncUnit = 'month'
    if (range === 'daily') dateTruncUnit = 'day'
    else if (range === 'weekly') dateTruncUnit = 'week'
    else dateTruncUnit = 'month'

    const match = {}
    // only completed rides count towards earnings
    match.status = 'completed'
    if (driverId) match.driver = driverId

    // optional date filter: ?from=2025-01-01&to=2025-02-01
    if (req.query.from || req.query.to) {
      match.createdAt = {}
      if (req.query.from) match.createdAt.$gte = new Date(req.query.from)
      if (req.query.to) match.createdAt.$lte = new Date(req.query.to)
    }

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: {
            $dateTrunc: { date: '$createdAt', unit: dateTruncUnit },
          },
          totalRevenue: { $sum: { $ifNull: ['$fare', 0] } },
          rideCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          period: '$_id',
          totalRevenue: 1,
          rideCount: 1,
          _id: 0,
        },
      },
    ]

    const results = await Ride.aggregate(pipeline).allowDiskUse(true)
    return res.json({ ok: true, data: results })
  } catch (err) {
    console.error('getEarnings error', err)
    return res.status(500).json({ ok: false, message: 'Server error' })
  }
}



  async function getSummary(req, res)  {
  try {
    const totalRides = await Ride.countDocuments();
    const completedRides = await Ride.countDocuments({ status: "completed" });

    const totalRevenueData = await Ride.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$fare" } } }
    ]);
    const totalRevenue = totalRevenueData[0]?.total || 0;

    const activeDrivers = await User.countDocuments({ role: "driver" });
    const activeUsers = await User.countDocuments({ role: "user" });

    res.json({
      totalRides,
      completedRides,
      totalRevenue,
      activeDrivers,
      activeUsers
    });
    
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};



module.exports = { getEarnings, getSummary }
