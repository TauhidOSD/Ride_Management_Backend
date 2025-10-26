// src/controllers/analyticsController.js
const mongoose = require('mongoose')
const Ride = require('../models/rideModel')
const User = require('../models/User') // adjust path/casing if your file is different

function toObjectIdIfPossible(id) {
  if (!id) return undefined
  try {
    return mongoose.Types.ObjectId(id)
  } catch (e) {
    return undefined
  }
}


async function getEarnings(req, res) {
  try {
    // --- PERMISSION CHECK ---
    // auth middleware should set req.user
    const requester = req.user
    const driverIdRaw = req.query.driverId
    // do not convert yet; we want to compare string forms
    if (driverIdRaw && requester) {
      // if requester is driver, they can only request their own driverId
      if (requester.role === 'driver' && String(requester._id) !== String(driverIdRaw)) {
        return res.status(403).json({ ok: false, message: 'Forbidden: cannot access other driver data' })
      }
      // admins allowed for any driverId
    }
    // ---------- end permission check ----------

    const range = (req.query.range || 'monthly').toLowerCase()
    const driverId = toObjectIdIfPossible(driverIdRaw)

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

    // aggregation (try $dateTrunc, fallback handled by earlier code if needed)
    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: { $dateTrunc: { date: '$createdAt', unit: dateTruncUnit } },
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
// async function getEarnings(req, res) {
//   try {
//     const range = (req.query.range || 'monthly').toLowerCase()
//     const driverIdRaw = req.query.driverId
//     const driverId = toObjectIdIfPossible(driverIdRaw)

//     // pipeline grouping format by range
//     let dateTruncUnit = 'month'
//     if (range === 'daily') dateTruncUnit = 'day'
//     else if (range === 'weekly') dateTruncUnit = 'week'
//     else dateTruncUnit = 'month'

//     const match = {}
//     // only completed rides count towards earnings
//     match.status = 'completed'
//     if (driverId) match.driver = driverId

//     // optional date filter: ?from=2025-01-01&to=2025-02-01 (accept ISO or YYYY-MM-DD)
//     if (req.query.from || req.query.to) {
//       match.createdAt = {}
//       if (req.query.from) match.createdAt.$gte = new Date(req.query.from)
//       if (req.query.to) match.createdAt.$lte = new Date(req.query.to)
//     }

//     // Try with $dateTrunc first (Mongo 5.0+). If fails, fallback to $dateToString grouping.
//     let pipeline = [
//       { $match: match },
//       {
//         $group: {
//           _id: { $dateTrunc: { date: '$createdAt', unit: dateTruncUnit } },
//           totalRevenue: { $sum: { $ifNull: ['$fare', 0] } },
//           rideCount: { $sum: 1 }
//         }
//       },
//       { $sort: { _id: 1 } },
//       {
//         $project: {
//           period: '$_id',
//           totalRevenue: 1,
//           rideCount: 1,
//           _id: 0
//         }
//       }
//     ]

//     let results = []
//     try {
//       // allowDiskUse may help for large collections
//       results = await Ride.aggregate(pipeline).allowDiskUse(true)
//     } catch (aggErr) {
//       // fallback: if $dateTrunc unsupported, use $dateToString grouping by format
//       console.warn('dateTrunc aggregation failed, falling back to dateToString grouping:', aggErr.message)
//       // choose format depending on range
//       let fmt = '%Y-%m' // monthly
//       if (dateTruncUnit === 'day') fmt = '%Y-%m-%d'
//       if (dateTruncUnit === 'week') {
//         // week fallback - group by year-week string
//         pipeline = [
//           { $match: match },
//           {
//             $group: {
//               _id: { $concat: [
//                 { $toString: { $year: '$createdAt' } },
//                 '-W',
//                 { $toString: { $isoWeek: '$createdAt' } } // note: $isoWeek requires newer mongo; may fail
//               ] },
//               totalRevenue: { $sum: { $ifNull: ['$fare', 0] } },
//               rideCount: { $sum: 1 }
//             }
//           },
//           { $sort: { _id: 1 } },
//           { $project: { period: '$_id', totalRevenue: 1, rideCount: 1, _id: 0 } }
//         ]
//       } else {
//         // day/month fallback using dateToString
//         pipeline = [
//           { $match: match },
//           {
//             $group: {
//               _id: { $dateToString: { format: fmt, date: '$createdAt' } },
//               totalRevenue: { $sum: { $ifNull: ['$fare', 0] } },
//               rideCount: { $sum: 1 }
//             }
//           },
//           { $sort: { _id: 1 } },
//           {
//             $project: {
//               period: '$_id',
//               totalRevenue: 1,
//               rideCount: 1,
//               _id: 0
//             }
//           }
//         ]
//       }

//       // try fallback aggregation
//       try {
//         results = await Ride.aggregate(pipeline).allowDiskUse(true)
//         // If using dateToString, convert period strings to ISO-ish where possible
//         results = results.map(r => {
//           // if period is string like "2025-10-26" or "2025-10" keep as-is
//           return r
//         })
//       } catch (fallbackErr) {
//         console.error('Fallback aggregation also failed:', fallbackErr)
//         // return empty to avoid crash
//         results = []
//       }
//     }

//     return res.json({ ok: true, data: results })
//   } catch (err) {
//     console.error('getEarnings error', err)
//     return res.status(500).json({ ok: false, message: 'Server error' })
//   }
// }

async function getSummary(req, res) {
  try {
    // counts and sums - robust with try/catch per op
    const totalRides = await Ride.countDocuments().catch(e => { console.error('countDocuments totalRides:', e); return 0 })
    const completedRides = await Ride.countDocuments({ status: 'completed' }).catch(e => { console.error('countDocuments completedRides:', e); return 0 })

    const totalRevenueAgg = await Ride.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$fare', 0] } } } }
    ]).catch(e => { console.error('totalRevenueAgg error:', e); return [] })
    const totalRevenue = (totalRevenueAgg && totalRevenueAgg[0] && totalRevenueAgg[0].total) ? totalRevenueAgg[0].total : 0

    // ensure User model exists (imported at top)
    const activeDrivers = await User.countDocuments({ role: 'driver' }).catch(e => { console.error('activeDrivers error:', e); return 0 })
    const activeUsers = await User.countDocuments({ role: { $in: ['rider', 'user'] } }).catch(e => { console.error('activeUsers error:', e); return 0 })

    return res.json({ ok: true, totalRides, completedRides, totalRevenue, activeDrivers, activeUsers })
  } catch (err) {
    console.error('getSummary error', err)
    return res.status(500).json({ ok: false, message: err.message || 'Server error' })
  }
}

module.exports = { getEarnings, getSummary }
