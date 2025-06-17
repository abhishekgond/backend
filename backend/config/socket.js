export function setupSocket(io) {
  const userSocketMap = {};
  const roomCodeMap = {};
  const roomVersionsMap = {};
  const roomPlaybackMap = {};
  const roomCommentsMap = {};
  const roomRolesMap = {};
  const roomCursorsMap = {};
  const roomChatMap = {};
  const lockedRooms = new Set();
  const bannedUsers = {};

  const getAllConnectedClients = (roomId) => {
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room) return [];
    return Array.from(room).map((socketId) => ({
      socketId,
      userName: userSocketMap[socketId] || "Unknown",
      role: roomRolesMap[roomId]?.[socketId] || "viewer",
    }));
  };

  const assignColor = () => {
    const colors = [
      "#FF0000",
      "#00FF00",
      "#0000FF",
      "#FFFF00",
      "#FF00FF",
      "#00FFFF",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  io.on("connection", (socket) => {
    socket.on("join", ({ roomId, userName }) => {
      if (lockedRooms.has(roomId)) {
        io.to(socket.id).emit("room-locked-error", "Room is locked.");
        return;
      }
      if (bannedUsers[roomId]?.has(socket.id)) {
        io.to(socket.id).emit("banned", "You are banned from this room.");
        return;
      }

      userSocketMap[socket.id] = userName;
      socket.join(roomId);

      if (!roomCodeMap[roomId]) roomCodeMap[roomId] = "";
      if (!roomVersionsMap[roomId]) roomVersionsMap[roomId] = [];
      if (!roomPlaybackMap[roomId]) roomPlaybackMap[roomId] = [];
      if (!roomCommentsMap[roomId]) roomCommentsMap[roomId] = [];
      if (!roomRolesMap[roomId]) roomRolesMap[roomId] = {};
      if (!roomCursorsMap[roomId]) roomCursorsMap[roomId] = {};
      if (!roomChatMap[roomId]) roomChatMap[roomId] = [];

      roomRolesMap[roomId][socket.id] =
        Object.keys(roomRolesMap[roomId]).length === 0 ? "admin" : "viewer";

      const clients = getAllConnectedClients(roomId);

      clients.forEach((client) =>
        io
          .to(client.socketId)
          .emit("newUser", { clients, userName, socketId: socket.id })
      );

      io.to(socket.id).emit("code-sync", { code: roomCodeMap[roomId] });
      io.to(socket.id).emit("comments-sync", {
        comments: roomCommentsMap[roomId],
      });
      io.to(socket.id).emit("versions-sync", {
        versions: roomVersionsMap[roomId],
      });
      io.to(socket.id).emit("cursors-sync", {
        cursors: roomCursorsMap[roomId],
      });
      io.to(socket.id).emit("role-sync", {
        role: roomRolesMap[roomId][socket.id],
      });
      io.to(socket.id).emit("chat-history", roomChatMap[roomId]);
    });

    socket.on("code-change", ({ roomId, code }) => {
      roomCodeMap[roomId] = code;
      roomPlaybackMap[roomId].push({ code, timestamp: Date.now() });
      socket.to(roomId).emit("code-change", { code });
    });

    socket.on("save-version", ({ roomId, code }) => {
      roomVersionsMap[roomId].push({ code, timestamp: Date.now() });
      io.to(roomId).emit("versions-sync", {
        versions: roomVersionsMap[roomId],
      });
    });

    socket.on("load-version", ({ roomId, versionIndex }) => {
      const version = roomVersionsMap[roomId][versionIndex];
      if (version) io.to(roomId).emit("code-sync", { code: version.code });
    });

    socket.on("cursor-update", ({ roomId, line, ch }) => {
      const userName = userSocketMap[socket.id];
      if (!roomCursorsMap[roomId][socket.id]) {
        roomCursorsMap[roomId][socket.id] = { color: assignColor() };
      }
      roomCursorsMap[roomId][socket.id] = {
        ...roomCursorsMap[roomId][socket.id],
        line,
        ch,
        userName,
      };
      socket
        .to(roomId)
        .emit("cursors-sync", { cursors: roomCursorsMap[roomId] });
    });

    socket.on("add-comment", ({ roomId, line, text }) => {
      const userName = userSocketMap[socket.id];
      roomCommentsMap[roomId].push({
        line,
        text,
        userName,
        timestamp: Date.now(),
      });
      io.to(roomId).emit("comments-sync", {
        comments: roomCommentsMap[roomId],
      });
    });

    socket.on("chat-message", ({ roomId, message }) => {
      const userName = userSocketMap[socket.id];
      const msg = { userName, message, timestamp: Date.now() };
      roomChatMap[roomId].push(msg);
      io.to(roomId).emit("chat-message", msg);
    });

    socket.on("get-chat-history", ({ roomId }) => {
      io.to(socket.id).emit("chat-history", roomChatMap[roomId] || []);
    });

    socket.on("typing", ({ roomId, isTyping }) => {
      const userName = userSocketMap[socket.id];
      socket
        .to(roomId)
        .emit("user-typing", { socketId: socket.id, userName, isTyping });
    });

    socket.on("private-message", ({ toSocketId, message }) => {
      const from = { socketId: socket.id, userName: userSocketMap[socket.id] };
      io.to(toSocketId).emit("private-message", { from, message });
    });

    socket.on("raise-hand", ({ roomId }) => {
      const userName = userSocketMap[socket.id];
      io.to(roomId).emit("user-raised-hand", { socketId: socket.id, userName });
    });

    socket.on("lock-room", ({ roomId }) => {
      if (roomRolesMap[roomId][socket.id] === "admin") {
        lockedRooms.add(roomId);
        io.to(roomId).emit("room-locked");
      }
    });

    socket.on("unlock-room", ({ roomId }) => {
      if (roomRolesMap[roomId][socket.id] === "admin") {
        lockedRooms.delete(roomId);
        io.to(roomId).emit("room-unlocked");
      }
    });

    socket.on("ban-user", ({ roomId, targetSocketId }) => {
      if (roomRolesMap[roomId][socket.id] !== "admin") return;
      if (!bannedUsers[roomId]) bannedUsers[roomId] = new Set();
      bannedUsers[roomId].add(targetSocketId);
      io.to(targetSocketId).emit(
        "banned",
        "You have been banned by the admin."
      );
      io.sockets.sockets.get(targetSocketId)?.leave(roomId);
    });

    socket.on("transfer-admin", ({ roomId, toSocketId }) => {
      if (roomRolesMap[roomId][socket.id] !== "admin") return;
      roomRolesMap[roomId][toSocketId] = "admin";
      roomRolesMap[roomId][socket.id] = "viewer";
      io.to(toSocketId).emit("role-sync", { role: "admin" });
      io.to(socket.id).emit("role-sync", { role: "viewer" });
      io.to(roomId).emit("newUser", {
        clients: getAllConnectedClients(roomId),
      });
    });

    socket.on("disconnect", () => {
      const userName = userSocketMap[socket.id];
      delete userSocketMap[socket.id];
      for (const roomId of socket.rooms) {
        if (roomId !== socket.id) {
          delete roomCursorsMap[roomId][socket.id];
          delete roomRolesMap[roomId][socket.id];
          const clients = getAllConnectedClients(roomId);
          io.to(roomId).emit("user-left", { socketId: socket.id, userName });
          io.to(roomId).emit("newUser", { clients });
          io.to(roomId).emit("cursors-sync", {
            cursors: roomCursorsMap[roomId],
          });
        }
      }
    });

    socket.on("error", (err) => {
      console.error(`Socket error from ${socket.id}:`, err);
    });
  });
}
