import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection
let db = null;

export async function initDatabase() {
  try {
    db = await open({
      filename: path.join(__dirname, "messaging.db"),
      driver: sqlite3.Database,
    });

    // Create tables
    await db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        code INTEGER UNIQUE NOT NULL,
        invite_token TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        max_users INTEGER DEFAULT 10,
        created_by_username TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_negotiation_active BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS pending_join_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        requester_username TEXT NOT NULL,
        requester_socket_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_pending_join_room ON pending_join_requests (room_id);
      CREATE INDEX IF NOT EXISTS idx_pending_join_socket ON pending_join_requests (requester_socket_id);

      CREATE TABLE IF NOT EXISTS room_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        username TEXT NOT NULL,
        message TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS room_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        socket_id TEXT NOT NULL,
        username TEXT NOT NULL,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS negotiations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        option_a TEXT NOT NULL,
        option_b TEXT NOT NULL,
        votes_a INTEGER DEFAULT 0,
        votes_b INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        negotiation_id INTEGER NOT NULL,
        socket_id TEXT NOT NULL,
        vote TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (negotiation_id) REFERENCES negotiations (id) ON DELETE CASCADE
      );

      -- Index for faster lookups
      CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms (code);
      CREATE INDEX IF NOT EXISTS idx_rooms_invite_token ON rooms (invite_token);
      CREATE INDEX IF NOT EXISTS idx_room_messages_room_id ON room_messages (room_id);
      CREATE INDEX IF NOT EXISTS idx_room_users_room_id ON room_users (room_id);
      CREATE INDEX IF NOT EXISTS idx_room_users_socket_id ON room_users (socket_id);
    `);

    const tableInfo = await db.all("PRAGMA table_info(room_messages)");
    const hasReplyTo = tableInfo.some((c) => c.name === "reply_to_message_id");
    if (!hasReplyTo) {
      await db.exec(
        "ALTER TABLE room_messages ADD COLUMN reply_to_message_id INTEGER REFERENCES room_messages(id)"
      );
    }

    const roomsInfo = await db.all("PRAGMA table_info(rooms)");
    const hasCreatedBy = roomsInfo.some((c) => c.name === "created_by_username");
    if (!hasCreatedBy) {
      await db.exec("ALTER TABLE rooms ADD COLUMN created_by_username TEXT");
    }

    const pendingExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='pending_join_requests'"
    );
    if (!pendingExists) {
      await db.exec(`
        CREATE TABLE pending_join_requests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room_id TEXT NOT NULL,
          requester_username TEXT NOT NULL,
          requester_socket_id TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE
        );
        CREATE INDEX idx_pending_join_room ON pending_join_requests (room_id);
        CREATE INDEX idx_pending_join_socket ON pending_join_requests (requester_socket_id);
      `);
    }

    const channelConfigExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='channel_config'"
    );
    if (!channelConfigExists) {
      await db.exec(`
        CREATE TABLE channel_config (
          channel TEXT PRIMARY KEY,
          config_json TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE outbound_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          channel TEXT NOT NULL,
          recipient TEXT NOT NULL,
          body TEXT NOT NULL,
          status TEXT DEFAULT 'sent',
          external_id TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX idx_outbound_channel ON outbound_messages (channel);
      `);
    }

    const dealEventsExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='deal_events'"
    );
    if (!dealEventsExists) {
      await db.exec(`
        CREATE TABLE deal_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room_id TEXT NOT NULL,
          username TEXT NOT NULL,
          field TEXT NOT NULL,
          old_value TEXT,
          new_value TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE
        );
        CREATE INDEX idx_deal_events_room ON deal_events (room_id);
      `);
    }

    console.log("✅ Database initialized successfully");
    return db;
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
}

// Generate unique numeric room code
export async function generateRoomCode() {
  let code;
  let isUnique = false;

  while (!isUnique) {
    // Generate 6-digit numeric code
    code = Math.floor(100000 + Math.random() * 900000);

    // Check if code already exists
    const existing = await db.get("SELECT code FROM rooms WHERE code = ?", [
      code,
    ]);
    if (!existing) {
      isUnique = true;
    }
  }

  return code;
}

// Generate unique invite token
export async function generateInviteToken() {
  let token;
  let isUnique = false;

  while (!isUnique) {
    // Generate 32-character token
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    token = "";
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Check if token already exists
    const existing = await db.get(
      "SELECT invite_token FROM rooms WHERE invite_token = ?",
      [token]
    );
    if (!existing) {
      isUnique = true;
    }
  }

  return token;
}

// Room operations
export async function createRoom(
  { name, description, maxUsers = 10, createdByUsername },
  serverUrl
) {
  const roomId = generateUUID();
  const code = await generateRoomCode();
  const inviteToken = await generateInviteToken();
  const inviteLink = `${serverUrl}/invite/${inviteToken}`;

  await db.run(
    "INSERT INTO rooms (id, code, invite_token, name, description, max_users, created_by_username) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [roomId, code, inviteToken, name, description, maxUsers, createdByUsername ?? null]
  );

  return {
    id: roomId,
    code,
    inviteToken,
    name,
    description,
    maxUsers,
    createdByUsername: createdByUsername ?? null,
    inviteLink,
    userCount: 0,
    createdAt: new Date(),
    isNegotiationActive: false,
  };
}

export async function getRoomById(roomId) {
  const room = await db.get("SELECT * FROM rooms WHERE id = ?", [roomId]);
  if (!room) return null;

  const userCount = await db.get(
    "SELECT COUNT(*) as count FROM room_users WHERE room_id = ?",
    [roomId]
  );

  return {
    id: room.id,
    code: room.code,
    name: room.name,
    description: room.description,
    maxUsers: room.max_users,
    createdByUsername: room.created_by_username ?? null,
    userCount: userCount.count,
    createdAt: new Date(room.created_at),
    isNegotiationActive: room.is_negotiation_active,
    inviteToken: room.invite_token,
    inviteLink: `${process.env.SERVER_URL || "http://localhost:3000"}/invite/${
      room.invite_token
    }`,
  };
}

export async function getRoomByCode(code) {
  const room = await db.get("SELECT * FROM rooms WHERE code = ?", [code]);
  if (!room) return null;
  return getRoomById(room.id);
}

export async function getRoomByInviteToken(inviteToken) {
  const room = await db.get("SELECT * FROM rooms WHERE invite_token = ?", [
    inviteToken,
  ]);
  if (!room) return null;
  return getRoomById(room.id);
}

export async function getAllRooms() {
  const rooms = await db.all("SELECT * FROM rooms ORDER BY created_at DESC");

  const roomsWithCounts = await Promise.all(
    rooms.map(async (room) => {
      const userCount = await db.get(
        "SELECT COUNT(*) as count FROM room_users WHERE room_id = ?",
        [room.id]
      );
      return {
        id: room.id,
        code: room.code,
        name: room.name,
        description: room.description,
        maxUsers: room.max_users,
        createdByUsername: room.created_by_username ?? null,
        userCount: userCount.count,
        createdAt: new Date(room.created_at),
        isNegotiationActive: room.is_negotiation_active,
        inviteToken: room.invite_token,
        inviteLink: `${
          process.env.SERVER_URL || "http://localhost:3000"
        }/invite/${room.invite_token}`,
      };
    })
  );

  return roomsWithCounts;
}

export async function updateRoomInviteToken(roomId, serverUrl) {
  const newInviteToken = await generateInviteToken();
  const newInviteLink = `${serverUrl}/invite/${newInviteToken}`;

  await db.run("UPDATE rooms SET invite_token = ? WHERE id = ?", [
    newInviteToken,
    roomId,
  ]);

  return {
    inviteToken: newInviteToken,
    inviteLink: newInviteLink,
  };
}

export async function deleteRoom(roomId) {
  await db.run("DELETE FROM rooms WHERE id = ?", [roomId]);
}

// User operations
export async function addUserToRoom(roomId, socketId, username) {
  await db.run(
    "INSERT INTO room_users (room_id, socket_id, username) VALUES (?, ?, ?)",
    [roomId, socketId, username]
  );
}

export async function removeUserFromRoom(socketId) {
  const user = await db.get("SELECT * FROM room_users WHERE socket_id = ?", [
    socketId,
  ]);
  if (user) {
    await db.run("DELETE FROM room_users WHERE socket_id = ?", [socketId]);

    // Check if room is empty
    const remainingUsers = await db.get(
      "SELECT COUNT(*) as count FROM room_users WHERE room_id = ?",
      [user.room_id]
    );
    if (remainingUsers.count === 0) {
      // Room is empty, delete it
      await deleteRoom(user.room_id);
      console.log(`🧹 Cleaned up empty room: ${user.room_id}`);
    }

    return user;
  }
  return null;
}

export async function getRoomUsers(roomId) {
  const users = await db.all("SELECT * FROM room_users WHERE room_id = ?", [
    roomId,
  ]);
  return users;
}

export async function getUserBySocketId(socketId) {
  const user = await db.get("SELECT * FROM room_users WHERE socket_id = ?", [
    socketId,
  ]);
  return user;
}

export async function getRoomUserByUsername(roomId, username) {
  return db.get(
    "SELECT * FROM room_users WHERE room_id = ? AND username = ?",
    [roomId, username]
  );
}

/** Remove a user from a room by username (e.g. creator removing a member). */
export async function removeUserFromRoomByUsername(roomId, username) {
  const user = await getRoomUserByUsername(roomId, username);
  if (!user) return null;
  return removeUserFromRoom(user.socket_id);
}

/** Get socket_id of the room creator (if they are currently in the room). */
export async function getCreatorSocketIdInRoom(roomId) {
  const room = await db.get("SELECT created_by_username FROM rooms WHERE id = ?", [roomId]);
  if (!room || !room.created_by_username) return null;
  const creator = await getRoomUserByUsername(roomId, room.created_by_username);
  return creator ? creator.socket_id : null;
}

// Pending join requests (invite-link flow: requester waits for creator to accept/decline)
export async function addPendingJoinRequest(roomId, requesterUsername, requesterSocketId) {
  const result = await db.run(
    "INSERT INTO pending_join_requests (room_id, requester_username, requester_socket_id, status) VALUES (?, ?, ?, 'pending')",
    [roomId, requesterUsername, requesterSocketId]
  );
  return result.lastID;
}

export async function getPendingJoinRequest(requestId) {
  return db.get("SELECT * FROM pending_join_requests WHERE id = ? AND status = 'pending'", [
    requestId,
  ]);
}

export async function deletePendingJoinRequest(requestId) {
  await db.run("DELETE FROM pending_join_requests WHERE id = ?", [requestId]);
}

// Message operations
export async function saveMessage(roomId, username, message, replyToMessageId = null) {
  const result = await db.run(
    "INSERT INTO room_messages (room_id, username, message, reply_to_message_id) VALUES (?, ?, ?, ?)",
    [roomId, username, message, replyToMessageId]
  );

  return {
    id: result.lastID,
    roomId,
    username,
    message,
    replyToMessageId: replyToMessageId ?? undefined,
    timestamp: new Date(),
  };
}

export async function getRoomMessages(roomId, limit = 50) {
  const messages = await db.all(
    "SELECT * FROM room_messages WHERE room_id = ? ORDER BY timestamp DESC LIMIT ?",
    [roomId, limit]
  );

  return messages.reverse().map((msg) => {
    let message = msg.message;
    let type = "text";
    let location = undefined;
    let payload = undefined;
    try {
      const parsed = JSON.parse(msg.message);
      if (!parsed) return { id: msg.id, username: msg.username, message, type, replyToMessageId: msg.reply_to_message_id ?? undefined, timestamp: new Date(msg.timestamp) };
      if (typeof parsed.location !== "undefined") {
        type = "location";
        message = parsed.text;
        location = parsed.location;
      } else if (parsed.type === "announcement") {
        type = "announcement";
        message = parsed.text || parsed.message || message;
      } else if (parsed.type === "deal_terms") {
        type = "deal_terms";
        message = parsed.text || parsed.message || message;
        payload = { price: parsed.price, qty: parsed.qty, slaDays: parsed.slaDays, sla: parsed.sla };
      } else if (parsed.type === "document") {
        type = "document";
        message = parsed.text || parsed.filename || message;
        payload = { url: parsed.url, filename: parsed.filename };
      }
    } catch (_) {}
    const out = {
      id: msg.id,
      username: msg.username,
      message,
      type,
      location,
      payload,
      replyToMessageId: msg.reply_to_message_id ?? undefined,
      timestamp: new Date(msg.timestamp),
    };
    if (type === "document" && out.payload?.url) out.documentUrl = out.payload.url;
    return out;
  });
}

// Channel config (email, sms, whatsapp - our own engine)
export async function getChannelConfig(channel) {
  const row = await db.get("SELECT config_json, updated_at FROM channel_config WHERE channel = ?", [channel]);
  if (!row) return null;
  try {
    return { config: row.config_json ? JSON.parse(row.config_json) : {}, updatedAt: new Date(row.updated_at) };
  } catch (_) {
    return { config: {}, updatedAt: new Date(row.updated_at) };
  }
}

export async function setChannelConfig(channel, config) {
  const configJson = JSON.stringify(config || {});
  await db.run(
    "INSERT INTO channel_config (channel, config_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(channel) DO UPDATE SET config_json = excluded.config_json, updated_at = CURRENT_TIMESTAMP",
    [channel, configJson]
  );
  return getChannelConfig(channel);
}

export async function saveOutboundMessage(channel, recipient, body, status = "sent", externalId = null) {
  const result = await db.run(
    "INSERT INTO outbound_messages (channel, recipient, body, status, external_id) VALUES (?, ?, ?, ?, ?)",
    [channel, recipient, body, status, externalId]
  );
  return result.lastID;
}

// Deal events (audit trail: who changed what, when)
export async function addDealEvent(roomId, username, field, oldValue, newValue) {
  const result = await db.run(
    "INSERT INTO deal_events (room_id, username, field, old_value, new_value) VALUES (?, ?, ?, ?, ?)",
    [roomId, username, field, oldValue ?? null, String(newValue)]
  );
  return result.lastID;
}

export async function getDealEvents(roomId, limit = 50) {
  const rows = await db.all(
    "SELECT id, room_id, username, field, old_value, new_value, created_at FROM deal_events WHERE room_id = ? ORDER BY created_at DESC LIMIT ?",
    [roomId, limit]
  );
  return rows.reverse().map((r) => ({
    id: r.id,
    roomId: r.room_id,
    username: r.username,
    field: r.field,
    oldValue: r.old_value,
    newValue: r.new_value,
    createdAt: new Date(r.created_at),
  }));
}

// Utility function for UUID generation
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Export database instance
export { db };
