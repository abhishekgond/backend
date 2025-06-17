// import express from "express";
// import dotenv from "dotenv";
// import http from "http";
// import { Server } from "socket.io";
// import cors from "cors";

// // Load environment variables
// dotenv.config();

// // Setup Express
// const app = express();
// app.use(cors());

// // Create HTTP server
// const server = http.createServer(app);

// // Initialize Socket.IO
// const io = new Server(server, {
//   cors: {
//     origin: "*",
//     methods: ["GET", "POST"],
//     credentials: true,
//   },
// });

// const userSocketMap = {};
// const roomCodeMap = {};
// const roomVersionsMap = {};
// const roomPlaybackMap = {};
// const roomCommentsMap = {};
// const roomRolesMap = {};
// const roomCursorsMap = {};

// const getAllConnectedClients = (roomId) => {
//   const room = io.sockets.adapter.rooms.get(roomId);
//   if (!room) return [];
//   return Array.from(room).map((socketId) => ({
//     socketId,
//     userName: userSocketMap[socketId] || "Unknown",
//     role: roomRolesMap[roomId]?.[socketId] || "viewer",
//   }));
// };

// const assignColor = () => {
//   const colors = [
//     "#FF0000",
//     "#00FF00",
//     "#0000FF",
//     "#FFFF00",
//     "#FF00FF",
//     "#00FFFF",
//   ];
//   return colors[Math.floor(Math.random() * colors.length)];
// };

// io.on("connection", (socket) => {
//   // console.log(`✅ Connected: ${socket.id}`);

//   socket.on("join", ({ roomId, userName }) => {
//     if (typeof roomId !== "string" || typeof userName !== "string") {
//       socket.emit("error", "Invalid join data.");
//       return;
//     }

//     userSocketMap[socket.id] = userName;
//     socket.join(roomId);

//     if (!roomCodeMap[roomId]) roomCodeMap[roomId] = "";
//     if (!roomVersionsMap[roomId]) roomVersionsMap[roomId] = [];
//     if (!roomPlaybackMap[roomId]) roomPlaybackMap[roomId] = [];
//     if (!roomCommentsMap[roomId]) roomCommentsMap[roomId] = [];
//     if (!roomRolesMap[roomId]) roomRolesMap[roomId] = {};
//     if (!roomCursorsMap[roomId]) roomCursorsMap[roomId] = {};

//     roomRolesMap[roomId][socket.id] =
//       Object.keys(roomRolesMap[roomId]).length === 0 ? "admin" : "viewer";

//     const clients = getAllConnectedClients(roomId);
//     clients.forEach((client) => {
//       io.to(client.socketId).emit("newUser", {
//         clients,
//         userName,
//         socketId: socket.id,
//       });
//     });

//     socket.to(roomId).emit("user-joined", {
//       clients,
//       newUser: { socketId: socket.id, userName },
//     });

//     io.to(socket.id).emit("code-sync", {
//       socketId: socket.id,
//       code: roomCodeMap[roomId],
//     });
//     io.to(socket.id).emit("comments-sync", {
//       comments: roomCommentsMap[roomId],
//     });
//     io.to(socket.id).emit("versions-sync", {
//       versions: roomVersionsMap[roomId],
//     });
//     io.to(socket.id).emit("cursors-sync", { cursors: roomCursorsMap[roomId] });
//     io.to(socket.id).emit("role-sync", {
//       role: roomRolesMap[roomId][socket.id],
//     });
//   });

//   socket.on("join-room", ({ roomId }) => {
//     if (typeof roomId !== "string") {
//       socket.emit("error", "Invalid roomId.");
//       return;
//     }

//     const userName =
//       userSocketMap[socket.id] || `User-${socket.id.slice(0, 5)}`;
//     userSocketMap[socket.id] = userName;
//     socket.join(roomId);

//     if (roomCodeMap[roomId]) {
//       io.to(socket.id).emit("code-sync", {
//         socketId: socket.id,
//         code: roomCodeMap[roomId],
//       });
//     }
//   });

//   socket.on("code-change", ({ roomId, code }) => {
//     roomCodeMap[roomId] = code;
//     const timestamp = Date.now();
//     roomPlaybackMap[roomId].push({ code, timestamp });
//     socket.to(roomId).emit("code-change", { code });
//   });

//   socket.on("save-version", ({ roomId, code }) => {
//     const timestamp = Date.now();
//     roomVersionsMap[roomId].push({ code, timestamp });
//     io.to(roomId).emit("versions-sync", { versions: roomVersionsMap[roomId] });
//   });

//   socket.on("load-version", ({ roomId, versionIndex }) => {
//     const version = roomVersionsMap[roomId][versionIndex];
//     if (version) {
//       roomCodeMap[roomId] = version.code;
//       io.to(roomId).emit("code-sync", { code: version.code });
//     }
//   });

//   socket.on("cursor-update", ({ roomId, line, ch }) => {
//     const userName = userSocketMap[socket.id];
//     if (!roomCursorsMap[roomId][socket.id]) {
//       roomCursorsMap[roomId][socket.id] = { color: assignColor() };
//     }
//     roomCursorsMap[roomId][socket.id] = {
//       ...roomCursorsMap[roomId][socket.id],
//       line,
//       ch,
//       userName,
//     };
//     socket.to(roomId).emit("cursors-sync", { cursors: roomCursorsMap[roomId] });
//   });

//   socket.on("add-comment", ({ roomId, line, text }) => {
//     const userName = userSocketMap[socket.id];
//     const timestamp = Date.now();
//     roomCommentsMap[roomId].push({ line, text, userName, timestamp });
//     io.to(roomId).emit("comments-sync", { comments: roomCommentsMap[roomId] });
//   });

//   socket.on("chat-message", ({ roomId, message }) => {
//     const userName = userSocketMap[socket.id];
//     const timestamp = Date.now();
//     io.to(roomId).emit("chat-message", { userName, message, timestamp });
//   });

//   socket.on("run-code", ({ roomId, code, language }) => {
//     let output = "";
//     let error = null;
//     try {
//       if (language === "javascript") {
//         const consoleLog = [];
//         const originalConsoleLog = console.log;
//         console.log = (...args) => consoleLog.push(args.join(" "));
//         const result = eval(code);
//         console.log = originalConsoleLog;
//         output =
//           consoleLog.join("\n") +
//           (result !== undefined ? `\nResult: ${result}` : "");
//       } else {
//         output = "Execution not supported for this language.";
//       }
//     } catch (err) {
//       error = err.message;
//     }
//     io.to(socket.id).emit("run-output", { output, error });
//   });

//   socket.on("set-role", ({ roomId, socketId, role }) => {
//     const adminRole = roomRolesMap[roomId][socket.id];
//     if (adminRole !== "admin") {
//       socket.emit("error", "Only admins can set roles.");
//       return;
//     }
//     roomRolesMap[roomId][socketId] = role;
//     io.to(socketId).emit("role-sync", { role });
//     const clients = getAllConnectedClients(roomId);
//     io.to(roomId).emit("newUser", { clients });
//   });

//   socket.on("sync-code", ({ socketId }) => {
//     const roomId = Array.from(socket.rooms).find((id) => id !== socket.id);
//     if (roomId && roomCodeMap[roomId]) {
//       io.to(socketId).emit("code-sync", { code: roomCodeMap[roomId] });
//     }
//   });

//   socket.on("user-left", ({ roomId, userName, socketId }) => {
//     socket.leave(roomId);
//     const clients = getAllConnectedClients(roomId);
//     io.to(roomId).emit("user-left", { socketId, userName });
//     io.to(roomId).emit("newUser", { clients, userName, socketId });
//   });

//   socket.on("disconnect", () => {
//     const userName = userSocketMap[socket.id];
//     delete userSocketMap[socket.id];

//     for (const roomId of socket.rooms) {
//       if (roomId !== socket.id) {
//         delete roomCursorsMap[roomId][socket.id];
//         delete roomRolesMap[roomId][socket.id];
//         const clients = getAllConnectedClients(roomId);
//         io.to(roomId).emit("user-left", { socketId: socket.id, userName });
//         io.to(roomId).emit("newUser", {
//           clients,
//           userName,
//           socketId: socket.id,
//         });
//         io.to(roomId).emit("cursors-sync", { cursors: roomCursorsMap[roomId] });
//       }
//     }
//   });

//   socket.on("error", (err) => {
//     console.error(`🚨 Socket error from ${socket.id}:`, err);
//   });
// });

// const PORT = process.env.PORT || 5000;
// server.listen(PORT, () => {
//   // console.log(`🚀 Server running on port ${PORT}`);
// });

// backend/server.js
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
