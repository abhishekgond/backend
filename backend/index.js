
// backend/server.js
import express from "express";
import dotenv from "dotenv";
import http from "http";
import cors from "cors";
import { Server as SocketIOServer } from "socket.io";
import { setupSocket } from "./config/socket.js"; // Modularized socket handlers

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// Middlewares
app.use(
  cors({
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"],
    credentials: true,
  })
);
console.log("frontend Url are  " + process.env.CLIENT_URL);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create HTTP server
const server = http.createServer(app);

// Setup Socket.IO with proper CORS config
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Initialize socket logic
setupSocket(io);

// Default route for checking backend status
app.get("/", (req, res) => {
  res.status(200).send("✅ Backend is running");
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on ${PORT}`);
});
