// src/server.js
const http = require('http');
const app = require('./app');
const { initSocket } = require('./socket');
const connectDB = require('./config/db');

(async () => {
  await connectDB(process.env.MONGO_URI);
  const PORT = process.env.PORT || 5000;
  const server = http.createServer(app);
  const io = initSocket(server);

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();
