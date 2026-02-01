import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  initDatabase,
  createRoom,
  getRoomById,
  getRoomByCode,
  getRoomByInviteToken,
  getAllRooms,
  getRoomsForUser,
  updateRoomInviteToken,
  addUserToRoom,
  removeUserFromRoom,
  removeUserFromRoomByUsername,
  getRoomUsers,
  getRoomUserByUsername,
  getUserBySocketId,
  getCreatorSocketIdInRoom,
  addPendingJoinRequest,
  getPendingJoinRequest,
  deletePendingJoinRequest,
  getPendingJoinRequestsForCreator,
  saveMessage,
  getRoomMessages,
  getChannelConfig,
  setChannelConfig,
  saveOutboundMessage,
  addDealEvent,
  getDealEvents,
  getRoomMemberRoles,
  setRoomMemberRole,
} from "./database.js";
import { sendEmail, validateEmailConfig } from "./channels/email.js";
import { sendSms, sendSmsDev, validateSmsConfig } from "./channels/sms.js";
import { sendWhatsApp, sendWhatsAppDev, validateWhatsAppConfig } from "./channels/whatsapp.js";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// Initialize database
await initDatabase();

// Uploads directory for documents
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 15 * 1024 * 1024 } }); // 15 MB

// Serve uploaded files (before client dist so /uploads works)
app.use("/uploads", express.static(uploadsDir));

// Serve static files from client build
app.use(express.static("client/dist"));

// Store active socket connections (for real-time features)
const activeConnections = new Map(); // socketId -> { roomId, username }
// Map username -> Set of socketIds (so we can notify room creator even when not in room)
const usernameToSockets = new Map();

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/rooms", async (req, res) => {
  try {
    const { name, description, maxUsers = 10, createdBy } = req.body;
    const serverUrl = `${req.protocol}://${req.get("host")}`;

    const room = await createRoom(
      { name, description, maxUsers, createdByUsername: createdBy },
      serverUrl
    );

    res.json({
      roomId: room.id,
      roomCode: room.code,
      name: room.name,
      description: room.description,
      createdByUsername: room.createdByUsername,
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
    const username = req.query.username;
    const rooms = username ? await getRoomsForUser(username) : await getAllRooms();
    res.json(rooms);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

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

app.get("/api/rooms/invite/:inviteToken/status", async (req, res) => {
  try {
    const { inviteToken } = req.params;
    const username = req.query.username;
    if (!username || typeof username !== "string" || !username.trim()) {
      return res.status(400).json({ error: "username query is required" });
    }
    const room = await getRoomByInviteToken(inviteToken);
    if (!room) {
      return res.status(404).json({ error: "Invalid or expired invitation link" });
    }
    const member = await getRoomUserByUsername(room.id, username.trim());
    const accepted = !!member;
    if (accepted) {
      return res.json({ accepted: true, room });
    }
    return res.json({ accepted: false });
  } catch (error) {
    console.error("Error fetching invite status:", error);
    res.status(500).json({ error: "Failed to fetch status" });
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

app.get("/api/rooms/pending-requests", async (req, res) => {
  try {
    const creator = req.query.creator;
    if (!creator || typeof creator !== "string") {
      return res.json([]);
    }
    const list = await getPendingJoinRequestsForCreator(creator.trim());
    res.json(list);
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    res.status(500).json({ error: "Failed to fetch pending requests" });
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

app.get("/api/rooms/:roomId/messages", async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await getRoomById(roomId);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }
    const messages = await getRoomMessages(roomId);
    res.json(messages);
  } catch (error) {
    console.error("Error fetching room messages:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

app.get("/api/rooms/:roomId/deal-events", async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await getRoomById(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    const events = await getDealEvents(roomId);
    res.json(events);
  } catch (error) {
    console.error("Error fetching deal events:", error);
    res.status(500).json({ error: "Failed to fetch deal events" });
  }
});

app.get("/api/rooms/:roomId/invoice", async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await getRoomById(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    const { amount, currency = "KES", reference = "INV-" + Date.now() } = req.query;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice</title></head><body><h1>Invoice</h1><p>Room: ${room.name}</p><p>Reference: ${reference}</p><p>Amount: ${amount ?? "—"} ${currency}</p><p>KRA/VAT compliant placeholder. Configure smart invoicing in Settings.</p></body></html>`;
    res.setHeader("Content-Type", "text/html");
    res.send(html);
  } catch (error) {
    console.error("Error generating invoice:", error);
    res.status(500).json({ error: "Failed to generate invoice" });
  }
});

app.get("/api/rooms/:roomId/roles", async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await getRoomById(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    const roles = await getRoomMemberRoles(roomId);
    res.json(roles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

app.post("/api/rooms/:roomId/roles", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { username, role } = req.body;
    const room = await getRoomById(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (!username || !role) return res.status(400).json({ error: "username and role required" });
    const roles = await setRoomMemberRole(roomId, username, role);
    res.json(roles);
  } catch (error) {
    console.error("Error setting role:", error);
    res.status(500).json({ error: "Failed to set role" });
  }
});

app.post("/api/me/export", async (req, res) => {
  try {
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: "username required" });
    res.json({ status: "queued", message: "Data export requested. You will receive a link when ready. (KDPP/GDPR placeholder)" });
  } catch (error) {
    res.status(500).json({ error: "Export failed" });
  }
});

app.post("/api/me/delete", async (req, res) => {
  try {
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: "username required" });
    res.json({ status: "accepted", message: "Right to be Forgotten request received. Data will be removed within 30 days. (KDPP/GDPR placeholder)" });
  } catch (error) {
    res.status(500).json({ error: "Delete request failed" });
  }
});

// Generate new invite link for existing room (only room creator, and must be in room)
app.post("/api/rooms/:roomId/invite", async (req, res) => {
  try {
    const { roomId } = req.params;
    const { invitedBy } = req.body || {};
    const serverUrl = `${req.protocol}://${req.get("host")}`;

    const room = await getRoomById(roomId);
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    if (!invitedBy || typeof invitedBy !== "string" || !invitedBy.trim()) {
      return res.status(400).json({ error: "invitedBy (username) is required" });
    }
    const username = invitedBy.trim();

    if (room.createdByUsername !== username) {
      return res.status(403).json({
        error: "Only the room creator can generate invite links",
      });
    }

    const users = await getRoomUsers(roomId);
    const isInRoom = users.some((u) => u.username === username);
    if (!isInRoom) {
      return res.status(403).json({
        error: "You must be in the room to invite others",
      });
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

// Document upload (room-scoped)
app.post("/api/rooms/:roomId/upload", upload.single("file"), async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await getRoomById(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const url = "/uploads/" + req.file.filename;
    res.json({ url, filename: req.file.originalname || req.file.filename });
  } catch (error) {
    console.error("Error uploading document:", error);
    res.status(500).json({ error: "Failed to upload document" });
  }
});

// ---------- Channels API (our own engine: Email, SMS, WhatsApp – no Twilio) ----------
function getServerBaseUrl(req) {
  return `${req.protocol}://${req.get("host")}`;
}

const CHANNEL_NAMES = ["email", "sms", "whatsapp", "identity", "payments"];

app.get("/api/channels/:channel", async (req, res) => {
  try {
    const { channel } = req.params;
    if (!CHANNEL_NAMES.includes(channel)) {
      return res.status(400).json({ error: "Invalid channel" });
    }
    const data = await getChannelConfig(channel);
    res.json(data || { config: {}, updatedAt: null });
  } catch (err) {
    console.error("Error fetching channel config:", err);
    res.status(500).json({ error: "Failed to fetch config" });
  }
});

app.put("/api/channels/:channel", async (req, res) => {
  try {
    const { channel } = req.params;
    if (!CHANNEL_NAMES.includes(channel)) {
      return res.status(400).json({ error: "Invalid channel" });
    }
    const config = req.body || {};
    await setChannelConfig(channel, config);
    const data = await getChannelConfig(channel);
    res.json(data);
  } catch (err) {
    console.error("Error saving channel config:", err);
    res.status(500).json({ error: "Failed to save config" });
  }
});

app.post("/api/channels/email/send", async (req, res) => {
  try {
    const { to, subject, text, html } = req.body || {};
    if (!to) return res.status(400).json({ error: "to is required" });
    const { config } = (await getChannelConfig("email")) || {};
    const valid = validateEmailConfig(config);
    if (!valid.valid) return res.status(400).json({ error: valid.error || "Email not configured" });
    const result = await sendEmail(config, { to, subject, text, html });
    await saveOutboundMessage("email", Array.isArray(to) ? to.join(",") : to, text || html || subject || "", "sent", result.messageId);
    res.json({ success: true, messageId: result.messageId });
  } catch (err) {
    console.error("Error sending email:", err);
    res.status(500).json({ error: err.message || "Failed to send email" });
  }
});

app.post("/api/channels/sms/send", async (req, res) => {
  try {
    const { to, body } = req.body || {};
    if (!to) return res.status(400).json({ error: "to is required" });
    const { config } = (await getChannelConfig("sms")) || {};
    const sendFn = config && config.gatewayUrl ? sendSms : sendSmsDev;
    const result = await sendFn(config || {}, { to, body });
    await saveOutboundMessage("sms", String(to), body || "", "sent", result.externalId);
    res.json({ success: true, externalId: result.externalId });
  } catch (err) {
    console.error("Error sending SMS:", err);
    res.status(500).json({ error: err.message || "Failed to send SMS" });
  }
});

app.post("/api/channels/whatsapp/send", async (req, res) => {
  try {
    const { to, body } = req.body || {};
    if (!to) return res.status(400).json({ error: "to is required" });
    const { config } = (await getChannelConfig("whatsapp")) || {};
    const sendFn = config && config.apiUrl ? sendWhatsApp : sendWhatsAppDev;
    const result = await sendFn(config || {}, { to, body });
    await saveOutboundMessage("whatsapp", String(to), body || "", "sent", result.externalId);
    res.json({ success: true, externalId: result.externalId });
  } catch (err) {
    console.error("Error sending WhatsApp:", err);
    res.status(500).json({ error: err.message || "Failed to send WhatsApp" });
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

  socket.on("set-username", ({ username }) => {
    if (!username || typeof username !== "string") return;
    const u = username.trim();
    if (!usernameToSockets.has(u)) usernameToSockets.set(u, new Set());
    usernameToSockets.get(u).add(socket.id);
  });

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

      const existingUser = await getUserBySocketId(socket.id);
      const alreadyInRoom = existingUser && existingUser.room_id === roomId;

      if (!alreadyInRoom) {
        await addUserToRoom(roomId, socket.id, username);
        socket.to(roomId).emit("user-joined", { username, userId: socket.id });
      }
      activeConnections.set(socket.id, { roomId, username });
      socket.join(roomId);

      const messages = await getRoomMessages(roomId);
      socket.emit("message-history", messages);

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

  // Request to join via invite link (creator gets accept/decline; requester waits for join-approved or join-declined)
  socket.on("request-join-room", async ({ inviteToken, username }) => {
    try {
      if (!inviteToken || !username?.trim()) {
        socket.emit("error", { message: "inviteToken and username are required" });
        return;
      }
      const room = await getRoomByInviteToken(inviteToken);
      if (!room) {
        socket.emit("error", { message: "Invalid or expired invite link" });
        return;
      }
      if (room.userCount >= room.maxUsers) {
        socket.emit("error", { message: "Room is full" });
        return;
      }
      const requestId = await addPendingJoinRequest(room.id, username.trim(), socket.id);
      const creatorSocketId = await getCreatorSocketIdInRoom(room.id);
      const creatorUsername = room.createdByUsername;
      const targets = new Set();
      if (creatorSocketId) targets.add(creatorSocketId);
      if (creatorUsername && usernameToSockets.has(creatorUsername)) {
        usernameToSockets.get(creatorUsername).forEach((id) => targets.add(id));
      }
      if (targets.size > 0) {
        targets.forEach((sid) => {
          io.to(sid).emit("join-request", {
            requestId,
            roomId: room.id,
            roomName: room.name,
            requesterUsername: username.trim(),
          });
        });
      } else {
        socket.emit("error", { message: "Room creator is not available to approve your request. Ask them to open the app." });
        await deletePendingJoinRequest(requestId);
      }
    } catch (error) {
      console.error("Error requesting join:", error);
      socket.emit("error", { message: "Failed to request join" });
    }
  });

  socket.on("join-request-accept", async ({ requestId }) => {
    try {
      const connection = activeConnections.get(socket.id);
      if (!connection) return;
      const pending = await getPendingJoinRequest(requestId);
      if (!pending) {
        socket.emit("error", { message: "Request not found or already handled" });
        return;
      }
      const room = await getRoomById(pending.room_id);
      if (!room) return;
      if (room.createdByUsername !== connection.username) {
        socket.emit("error", { message: "Only the room creator can accept join requests" });
        return;
      }
      if (room.userCount >= room.maxUsers) {
        socket.emit("error", { message: "Room is full" });
        await deletePendingJoinRequest(requestId);
        io.to(pending.requester_socket_id).emit("join-declined", { roomId: room.id, roomName: room.name });
        return;
      }
      await addUserToRoom(pending.room_id, pending.requester_socket_id, pending.requester_username);
      activeConnections.set(pending.requester_socket_id, { roomId: pending.room_id, username: pending.requester_username });
      const requesterSocket = io.sockets.sockets.get(pending.requester_socket_id);
      if (requesterSocket) requesterSocket.join(pending.room_id);
      const messages = await getRoomMessages(pending.room_id);
      const users = await getRoomUsers(pending.room_id);
      io.to(pending.requester_socket_id).emit("join-approved", {
        roomId: pending.room_id,
        roomName: room.name,
        roomDescription: room.description,
        roomCode: room.code,
        maxUsers: room.maxUsers,
        createdByUsername: room.createdByUsername,
        messages,
        users: users.map((u) => u.username),
        userCount: users.length,
      });
      socket.to(pending.room_id).emit("user-joined", { username: pending.requester_username, userId: pending.requester_socket_id });
      io.to(pending.room_id).emit("room-update", { userCount: users.length, users: users.map((u) => u.username) });
      await deletePendingJoinRequest(requestId);
    } catch (error) {
      console.error("Error accepting join request:", error);
      socket.emit("error", { message: "Failed to accept request" });
    }
  });

  socket.on("join-request-decline", async ({ requestId }) => {
    try {
      const connection = activeConnections.get(socket.id);
      if (!connection) return;
      const pending = await getPendingJoinRequest(requestId);
      if (!pending) return;
      const room = await getRoomById(pending.room_id);
      if (!room) return;
      if (room.createdByUsername !== connection.username) {
        socket.emit("error", { message: "Only the room creator can decline join requests" });
        return;
      }
      await deletePendingJoinRequest(requestId);
      io.to(pending.requester_socket_id).emit("join-declined", { roomId: pending.room_id, roomName: room.name });
    } catch (error) {
      console.error("Error declining join request:", error);
    }
  });

  socket.on("remove-member", async ({ roomId, targetUsername }) => {
    try {
      const connection = activeConnections.get(socket.id);
      if (!connection || connection.roomId !== roomId) {
        socket.emit("error", { message: "You are not in this room" });
        return;
      }
      const room = await getRoomById(roomId);
      if (!room) return;
      if (room.createdByUsername !== connection.username) {
        socket.emit("error", { message: "Only the room creator can remove members" });
        return;
      }
      if (connection.username === targetUsername) {
        socket.emit("error", { message: "Use Leave to exit the room yourself" });
        return;
      }
      const removed = await removeUserFromRoomByUsername(roomId, targetUsername);
      if (!removed) {
        socket.emit("error", { message: "User not found in room" });
        return;
      }
      activeConnections.delete(removed.socket_id);
      const removedSocket = io.sockets.sockets.get(removed.socket_id);
      if (removedSocket) removedSocket.leave(roomId);
      io.to(removed.socket_id).emit("removed-from-room", { roomId, roomName: room.name });
      socket.to(roomId).emit("user-left", { username: targetUsername });
      const users = await getRoomUsers(roomId);
      io.to(roomId).emit("room-update", { userCount: users.length, users: users.map((u) => u.username) });
    } catch (error) {
      console.error("Error removing member:", error);
      socket.emit("error", { message: "Failed to remove member" });
    }
  });

  socket.on("update-deal-term", async ({ roomId, field, oldValue, newValue }) => {
    try {
      const connection = activeConnections.get(socket.id);
      if (!connection || connection.roomId !== roomId) return;
      const room = await getRoomById(roomId);
      if (!room) return;
      const eventId = await addDealEvent(roomId, connection.username, field, oldValue ?? null, newValue);
      const event = {
        id: eventId,
        username: connection.username,
        field,
        oldValue: oldValue ?? null,
        newValue: String(newValue),
        createdAt: new Date(),
      };
      io.to(roomId).emit("deal-event", event);
      io.to(roomId).emit("deal-term-updated", { field, newValue: String(newValue) });
    } catch (error) {
      console.error("Error updating deal term:", error);
      socket.emit("error", { message: "Failed to update term" });
    }
  });

  socket.on("send-message", async ({ message, type = "text", location, replyToMessageId, payload, clientId }) => {
    try {
      const connection = activeConnections.get(socket.id);
      if (!connection) return;

      const { roomId, username } = connection;
      const room = await getRoomById(roomId);
      if (!room) return;

      let messageContent = message;
      let locationData = null;

      if (type === "deal_terms" && payload) {
        messageContent = JSON.stringify({ type: "deal_terms", text: message || "Deal terms", ...payload });
      } else if (type === "document" && payload && payload.url) {
        messageContent = JSON.stringify({ type: "document", text: message || payload.filename, url: payload.url, filename: payload.filename });
      } else if (type === "redline" && payload) {
        messageContent = JSON.stringify({ type: "redline", text: message || "Suggested edit", original: payload.original, suggested: payload.suggested });
      } else if (type === "signature" && payload) {
        messageContent = JSON.stringify({ type: "signature", text: message || "Signature", imageUrl: payload.imageUrl, label: payload.label });
      } else if (type === "payment_request" && payload) {
        messageContent = JSON.stringify({ type: "payment_request", text: message || "Payment request", ...payload });
      } else if (type === "location" && location) {
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
      } else if (type === "announcement") {
        messageContent = JSON.stringify({ text: message, type: "announcement" });
      }

      const messageData = await saveMessage(roomId, username, messageContent, replyToMessageId || null);

      // Add additional data for real-time broadcast
      const fullMessageData = {
        ...messageData,
        type,
        userId: socket.id,
        replyToMessageId: messageData.replyToMessageId ?? undefined,
        clientId: clientId ?? undefined,
      };

      // If it's a location message, parse and add location data to the broadcast
      if (type === "location" && locationData) {
        const parsedContent = JSON.parse(messageData.message);
        fullMessageData.message = parsedContent.text;
        fullMessageData.location = parsedContent.location;
      }
      if (type === "deal_terms" && payload) {
        fullMessageData.message = message || "Deal terms";
        fullMessageData.payload = payload;
      }
      if (type === "document" && payload) {
        fullMessageData.message = message || payload.filename;
        fullMessageData.payload = payload;
        fullMessageData.documentUrl = payload.url;
      }
      if (type === "redline" && payload) {
        fullMessageData.message = message || "Suggested edit";
        fullMessageData.payload = payload;
      }
      if (type === "signature" && payload) {
        fullMessageData.message = message || "Signature";
        fullMessageData.payload = payload;
      }
      if (type === "payment_request" && payload) {
        fullMessageData.message = message || "Payment request";
        fullMessageData.payload = payload;
      }

      io.to(roomId).emit("new-message", fullMessageData);
    } catch (error) {
      console.error("Error sending message:", error);
    }
  });

  socket.on("message-delivered", ({ messageId, roomId }) => {
    const connection = activeConnections.get(socket.id);
    if (!connection || connection.roomId !== roomId) return;
    io.to(roomId).emit("message-delivered", { messageId });
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
      usernameToSockets.forEach((set, key) => {
        set.delete(socket.id);
        if (set.size === 0) usernameToSockets.delete(key);
      });
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

const PORT = process.env.PORT || 3000;

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
