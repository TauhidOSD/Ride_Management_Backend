// src/controllers/emergencyController.js
const User = require('../models/User');
const Ride = require('../models/rideModel');
const { getIo } = require('../socket'); 
const nodemailer = require('nodemailer'); 

async function sendEmailNotification({ to, subject, text, html }) {
  if (!process.env.SMTP_HOST) {
    // SMTP not configured — skip quietly
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
    const user = req.user; // auth middleware should set this
    const { rideId, contactIds = [], message = '', shareLocation = false } = req.body;

    // Build payload
    const payload = {
      fromUser: { id: user._id, name: user.name, phone: user.phone, role: user.role },
      rideId: rideId || null,
      message: message || `${user.name} triggered an emergency alert`,
      shareLocation: Boolean(shareLocation),
      ts: Date.now(),
    };

    // resolve contacts: if contactIds provided (user ids), fetch them, otherwise try user's saved contacts
    let contacts = [];
    if (Array.isArray(contactIds) && contactIds.length > 0) {
      contacts = await User.find({ _id: { $in: contactIds } }).select('name email phone');
    } else {
      const me = await User.findById(user._id).select('emergencyContacts');
      // emergencyContacts could be array of objects or ids - handle common cases
      if (Array.isArray(me?.emergencyContacts) && me.emergencyContacts.length > 0) {
        // if stored as user refs
        const ids = me.emergencyContacts.filter(c => c?._id).map(c => c._id);
        if (ids.length) {
          contacts = await User.find({ _id: { $in: ids } }).select('name email phone');
        } else {
          // fallback: use stored plain contacts (name/phone/email)
          contacts = me.emergencyContacts;
        }
      }
    }

    // notify via socket (if running)
    const io = getIo && getIo();
    if (io) {
      // if contacts are user docs with _id, emit to their rooms
      if (contacts && contacts.length) {
        for (const c of contacts) {
          if (c?._id) {
            io.to(`user:${c._id}`).emit('emergency:alert', payload);
          }
        }
      } else {
        // no contact accounts found — notify admins as fallback
        io.to('admins').emit('emergency:alert', payload);
      }
    }

    // optional: send emails if contacts have emails or fallback admin email set
    const emails = (contacts || []).map(c => c?.email).filter(Boolean);
    if (emails.length === 0 && process.env.CONTACT_EMAIL) emails.push(process.env.CONTACT_EMAIL);

    if (emails.length > 0 && process.env.SMTP_HOST) {
      const subject = `Emergency alert from ${user.name}`;
      const text = `${payload.message}\nRide: ${payload.rideId || 'N/A'}\nTime: ${new Date(payload.ts).toLocaleString()}`;
      const html = `<p>${payload.message}</p><pre>${JSON.stringify(payload, null, 2)}</pre>`;
      try {
        await sendEmailNotification({ to: emails.join(','), subject, text, html });
      } catch (err) {
        console.error('email send error', err);
      }
    }

    // respond
    return res.json({ ok: true, payload, notified: (contacts || []).length });
  } catch (err) {
    console.error('triggerEmergency error', err);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
}

module.exports = { triggerEmergency };
