import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import {
  initDatabase,
  createRoom,
  getRoomById,
  getRoomByCode,
  getRoomByInviteToken,
  getAllRooms,
  updateRoomInviteToken,
  addUserToRoom,
  removeUserFromRoom,
  getRoomUsers,
  getUserBySocketId,
  saveMessage,
  getRoomMessages,
} from "./database.js";

// Environment configuration
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CLIENT_URL = process.env.CLIENT_URL || `http://localhost:${PORT}`;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
  },
});

app.use(cors({
  origin: CORS_ORIGIN
}));
app.use(express.json());

// Initialize database
await initDatabase();

// Serve static files from client build
app.use(express.static("client/dist"));

// Store active socket connections (for real-time features)
const activeConnections = new Map(); // socketId -> { roomId, username }

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/rooms", async (req, res) => {
  try {
    const { name, description, maxUsers = 10 } = req.body;
    const serverUrl = `${req.protocol}://${req.get("host")}`;

    const room = await createRoom({ name, description, maxUsers }, serverUrl);

    res.json({
      roomId: room.id,
      roomCode: room.code,
      name: room.name,
      description: room.description,
      inviteToken: room.inviteToken,
      inviteLink: room.inviteLink,
    });
  } catch (error) {
    console.error("Error creating room:", error);
    res.status(500).json({ error: "Failed to create room" });
  }
});

function generateRoomCode() {
  // Generate a 6-character alphanumeric code
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Ensure uniqueness
  if (roomCodes.has(code)) {
    return generateRoomCode(); // Recursive retry if duplicate
  }
  return code;
}

function generateInviteToken() {
  // Generate a secure invite token
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  for (let i = 0; i < 32; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Ensure uniqueness
  if (inviteLinks.has(token)) {
    return generateInviteToken(); // Recursive retry if duplicate
  }
  return token;
}

app.get("/api/rooms", async (req, res) => {
  try {
    const rooms = await getAllRooms();
    res.json(rooms);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

app.get("/api/rooms/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await getRoomById(roomId);

    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    res.json(room);
  } catch (error) {
    console.error("Error fetching room:", error);
    res.status(500).json({ error: "Failed to fetch room" });
  }
});

app.get("/api/rooms/code/:roomCode", async (req, res) => {
  try {
    const { roomCode } = req.params;
    const room = await getRoomByCode(parseInt(roomCode));

    if (!room) {
      return res.status(404).json({ error: "Room not found with this code" });
    }

    res.json(room);
  } catch (error) {
    console.error("Error fetching room by code:", error);
    res.status(500).json({ error: "Failed to fetch room" });
  }
});

// New endpoint for invite token lookup
app.get("/api/rooms/invite/:inviteToken", async (req, res) => {
  try {
    const { inviteToken } = req.params;
    const room = await getRoomByInviteToken(inviteToken);

    if (!room) {
      return res
        .status(404)
        .json({ error: "Invalid or expired invitation link" });
    }

    res.json(room);
  } catch (error) {
    console.error("Error fetching room by invite token:", error);
    res.status(500).json({ error: "Failed to fetch room" });
  }
});

// Generate new invite link for existing room
app.post("/api/rooms/:roomId/invite", async (req, res) => {
  try {
    const { roomId } = req.params;
    const serverUrl = `${req.protocol}://${req.get("host")}`;

    const room = await getRoomById(roomId);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    const { inviteToken, inviteLink } = await updateRoomInviteToken(
      roomId,
      serverUrl
    );

    res.json({
      inviteToken,
      inviteLink,
      roomCode: room.code,
      roomName: room.name,
    });
  } catch (error) {
    console.error("Error generating new invite:", error);
    res.status(500).json({ error: "Failed to generate new invite" });
  }
});

// Frontend route handler for invite links
app.get("/invite/:inviteToken", async (req, res) => {
  try {
    const { inviteToken } = req.params;
    const room = await getRoomByInviteToken(inviteToken);

    if (!room) {
      // Redirect to main page with error
      return res.redirect("/?error=invalid-invite");
    }

    // Redirect to main page with invite token
    res.redirect(`/?invite=${inviteToken}`);
  } catch (error) {
    console.error("Error handling invite link:", error);
    res.redirect("/?error=invite-error");
  }
});

// Socket.IO Events
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", async ({ roomId, username }) => {
    try {
      const room = await getRoomById(roomId);
      if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
      }

      if (room.userCount >= room.maxUsers) {
        socket.emit("error", { message: "Room is full" });
        return;
      }

      // Store user info in database and active connections
      await addUserToRoom(roomId, socket.id, username);
      activeConnections.set(socket.id, { roomId, username });

      socket.join(roomId);

      // Send existing messages to new user
      const messages = await getRoomMessages(roomId);
      socket.emit("message-history", messages);

      // Notify room about new user
      socket.to(roomId).emit("user-joined", { username, userId: socket.id });

      // Send updated room info
      const users = await getRoomUsers(roomId);
      io.to(roomId).emit("room-update", {
        userCount: users.length,
        users: users.map((u) => u.username),
      });
    } catch (error) {
      console.error("Error joining room:", error);
      socket.emit("error", { message: "Failed to join room" });
    }
  });

  socket.on("send-message", async ({ message, type = "text", location }) => {
    try {
      const connection = activeConnections.get(socket.id);
      if (!connection) return;

      const { roomId, username } = connection;
      const room = await getRoomById(roomId);
      if (!room) return;

      // For location messages, we need to handle the additional data
      let messageContent = message;
      let locationData = null;

      if (type === "location" && location) {
        locationData = {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          timestamp: location.timestamp,
        };
        messageContent = JSON.stringify({
          text: message,
          location: locationData,
        });
      }

      // Save message to database
      const messageData = await saveMessage(roomId, username, messageContent);

      // Add additional data for real-time broadcast
      const fullMessageData = {
        ...messageData,
        type,
        userId: socket.id,
      };

      // If it's a location message, parse and add location data to the broadcast
      if (type === "location" && locationData) {
        const parsedContent = JSON.parse(messageData.message);
        fullMessageData.message = parsedContent.text;
        fullMessageData.location = parsedContent.location;
      }

      io.to(roomId).emit("new-message", fullMessageData);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  });

  socket.on("start-negotiation", ({ proposal }) => {
    const user = users.get(socket.id);
    if (!user) return;

    const room = rooms.get(user.roomId);
    if (!room) return;

    room.isNegotiationActive = true;
    room.currentProposal = {
      id: uuidv4(),
      proposer: user.username,
      proposal,
      votes: new Map(),
      startedAt: new Date(),
    };

    io.to(user.roomId).emit("negotiation-started", {
      proposer: user.username,
      proposal,
      proposalId: room.currentProposal.id,
    });
  });

  socket.on("vote", ({ proposalId, vote }) => {
    const user = users.get(socket.id);
    if (!user) return;

    const room = rooms.get(user.roomId);
    if (
      !room ||
      !room.currentProposal ||
      room.currentProposal.id !== proposalId
    )
      return;

    room.currentProposal.votes.set(socket.id, {
      username: user.username,
      vote,
      timestamp: new Date(),
    });

    io.to(user.roomId).emit("vote-cast", {
      username: user.username,
      vote,
      totalVotes: room.currentProposal.votes.size,
      totalUsers: room.users.size,
    });

    // Check if all users voted
    if (room.currentProposal.votes.size === room.users.size) {
      const votes = Array.from(room.currentProposal.votes.values());
      const approve = votes.filter((v) => v.vote === "approve").length;
      const reject = votes.filter((v) => v.vote === "reject").length;

      room.isNegotiationActive = false;

      io.to(user.roomId).emit("negotiation-completed", {
        result: approve > reject ? "approved" : "rejected",
        votes: { approve, reject },
        details: votes,
      });
    }
  });

  socket.on("typing", ({ roomId, username }) => {
    socket.to(roomId).emit("user-typing", { username });
  });

  socket.on("stop-typing", ({ roomId, username }) => {
    socket.to(roomId).emit("user-stop-typing", { username });
  });

  socket.on("disconnect", async () => {
    try {
      const connection = activeConnections.get(socket.id);
      if (connection) {
        const { roomId, username } = connection;

        // Remove user from database
        const removedUser = await removeUserFromRoom(socket.id);

        if (removedUser) {
          socket.to(roomId).emit("user-left", { username });

          // Send updated room info
          const users = await getRoomUsers(roomId);
          io.to(roomId).emit("room-update", {
            userCount: users.length,
            users: users.map((u) => u.username),
          });
        }

        activeConnections.delete(socket.id);
      }
      console.log("User disconnected:", socket.id);
    } catch (error) {
      console.error("Error handling disconnect:", error);
    }
  });
});

// Handle port in use error
server
  .listen(PORT, () => {
    console.log(
      `🚀 Messaging platform server running on http://localhost:${PORT}`
    );
  })
  .on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`❌ Port ${PORT} is in use, trying port ${PORT + 1}...`);
      server
        .listen(PORT + 1, () => {
          console.log(
            `🚀 Messaging platform server running on http://localhost:${
              PORT + 1
            }`
          );
        })
        .on("error", (err2) => {
          if (err2.code === "EADDRINUSE") {
            console.log(
              `❌ Port ${PORT + 1} is also in use, trying port ${PORT + 2}...`
            );
            server.listen(PORT + 2, () => {
              console.log(
                `🚀 Messaging platform server running on http://localhost:${
                  PORT + 2
                }`
              );
            });
          }
        });
    } else {
      console.error("Server error:", err);
    }
  });
