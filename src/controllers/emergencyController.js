// src/controllers/emergencyController.js
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Ride = require('../models/rideModel');

async function sendEmailNotification({ to, subject, text, html }) {
  if (!process.env.SMTP_HOST) {
    console.warn('SMTP not configured — skipping email send');
    return { ok: false, reason: 'no-smtp' };
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: process.env.FROM_EMAIL || process.env.SMTP_USER,
    to,
    subject,
    text,
    html,
  });
  return { ok: true, info };
}

async function triggerEmergency(req, res) {
  try {
    // auth middleware should set req.user
    const user = req.user;
    const { rideId, contactIds, message, shareLocation } = req.body;

    // fetch optional ride and its rider/driver
    let ride = null;
    if (rideId) ride = await Ride.findById(rideId).select('rider driver pickup destination createdAt');

    // Resolve contacts: if contactIds provided, use them; else use user's saved emergencyContacts
    let contacts = [];
    if (Array.isArray(contactIds) && contactIds.length) {
      contacts = await User.find({ _id: { $in: contactIds } }).select('name email phone');
    } else {
      const u = await User.findById(user._id).select('emergencyContacts');
      // emergencyContacts can be array of {name, phone, email}
      contacts = u?.emergencyContacts || [];
    }

    // Build payload
    const payload = {
      fromUser: { id: user._id, name: user.name, phone: user.phone, role: user.role },
      rideId: ride?._id,
      rideSummary: ride ? { pickup: ride.pickup, destination: ride.destination } : undefined,
      message: message || `${user.name} triggered an emergency alert`,
      shareLocation: Boolean(shareLocation),
      ts: Date.now(),
    };

    // Notify via socket to each contact if they are connected (assumes getIo available)
    const { getIo } = require('../socket');
    const io = getIo();
    if (io && contacts.length) {
      contacts.forEach(c => {
        const room = `user:${c._id}`; // if contact has account
        io.to(room).emit('emergency:alert', payload);
      });
    } else if (io) {
      // fallback: broadcast to admins (room 'admins')
      io.to('admins').emit('emergency:alert', payload);
    }

    // Optional: send email to CONTACT_EMAIL or contact emails
    const emails = (contacts.map(c => c.email).filter(Boolean));
    if (emails.length === 0 && process.env.CONTACT_EMAIL) emails.push(process.env.CONTACT_EMAIL);

    if (emails.length > 0) {
      const subject = `Emergency alert from ${user.name}`;
      const text = `${payload.message}\n\nRide: ${ride?._id || 'N/A'}\nTime: ${new Date(payload.ts).toLocaleString()}`;
      const html = `<p>${payload.message}</p><pre>${JSON.stringify(payload, null, 2)}</pre>`;
      await sendEmailNotification({ to: emails.join(','), subject, text, html });
    }

    // Optionally store an emergency log collection (not required)
    // await Emergency.create({ user: user._id, ride: ride?._id, payload });

    return res.json({ ok: true, payload, notified: contacts.length });
  } catch (err) {
    console.error('triggerEmergency error', err);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
}

module.exports = { triggerEmergency };
