const analyticsRoutes = require('./routes/analyticsRoutes')
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('express-async-errors'); 

const emergencyRoutes = require('./routes/emergencyRoutes');
const authRoutes = require('./routes/authRoutes'); 
const userRoutes = require('./routes/userRoutes'); 
const rideRoutes = require('./routes/rideRoutes'); 
const errorHandler = require('./middleware/errorMiddleware');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));


app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/analytics', analyticsRoutes)
app.use('/api/emergency', emergencyRoutes);



app.get('/api/health', (req, res) => res.json({ ok: true }));


app.use(errorHandler);

module.exports = app;
