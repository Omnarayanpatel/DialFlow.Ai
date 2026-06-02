const path = require("path");
const http = require("http");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

const app = require("./app");
const { connectDB } = require("./config/db");
const { initSocket } = require("./services/socket.service");

const PORT = process.env.PORT || 5000;
const HOST = "0.0.0.0";

const startServer = async () => {
  try {
    await connectDB();

    const server = http.createServer(app);
    initSocket(server);

    server.listen(PORT, HOST, () => {
      console.log(`Backend server running at http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
