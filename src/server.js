
// src/server.js
const dotenv = require('dotenv');
dotenv.config();
const http = require('http');
const app = require('./app');
const connectDB = require('./config/db');
const { setupSocket } = require('./socket'); 

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB(process.env.MONGO_URI);

  const server = http.createServer(app);

  // setup socket.io
  setupSocket(server);

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();

