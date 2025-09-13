import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database configuration
const DATABASE_URL =
  process.env.DATABASE_URL || path.join(__dirname, "messaging.db");

// Database connection
let db = null;

export async function initDatabase() {
  try {
    // Handle both relative and absolute paths
    let dbPath;
    if (path.isAbsolute(DATABASE_URL)) {
      dbPath = DATABASE_URL;
      // Ensure the directory exists for absolute paths (like Render)
      const dbDir = path.dirname(dbPath);
      await import("fs").then((fs) =>
        fs.promises.mkdir(dbDir, { recursive: true })
      );
    } else {
      dbPath = path.join(__dirname, DATABASE_URL);
    }

    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    console.log(`📅 Database initialized at: ${dbPath}`);

    // Create tables
    await db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        code INTEGER UNIQUE NOT NULL,
        invite_token TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        max_users INTEGER DEFAULT 10,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_negotiation_active BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS room_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id TEXT NOT NULL,
        username TEXT NOT NULL,
        message TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        file_url TEXT,
        file_name TEXT,
        file_size INTEGER,
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

    // Add file support columns if they don't exist (migration)
    try {
      await db.exec(`
        ALTER TABLE room_messages ADD COLUMN message_type TEXT DEFAULT 'text';
      `);
    } catch (error) {
      // Column already exists, ignore error
    }

    try {
      await db.exec(`
        ALTER TABLE room_messages ADD COLUMN file_url TEXT;
        ALTER TABLE room_messages ADD COLUMN file_name TEXT;
        ALTER TABLE room_messages ADD COLUMN file_size INTEGER;
      `);
    } catch (error) {
      // Columns already exist, ignore error
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
  { name, description, maxUsers = 10 },
  serverUrl
) {
  const roomId = generateUUID();
  const code = await generateRoomCode();
  const inviteToken = await generateInviteToken();
  const inviteLink = `${serverUrl}/invite/${inviteToken}`;

  const result = await db.run(
    "INSERT INTO rooms (id, code, invite_token, name, description, max_users) VALUES (?, ?, ?, ?, ?, ?)",
    [roomId, code, inviteToken, name, description, maxUsers]
  );

  return {
    id: roomId,
    code,
    inviteToken,
    name,
    description,
    maxUsers,
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
    userCount: userCount.count,
    createdAt: new Date(room.created_at),
    isNegotiationActive: room.is_negotiation_active,
    inviteToken: room.invite_token,
    inviteLink: `${
      process.env.SERVER_URL || "https://chat-easy-integrate.onrender.com"
    }/invite/${room.invite_token}`,
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
        userCount: userCount.count,
        createdAt: new Date(room.created_at),
        isNegotiationActive: room.is_negotiation_active,
        inviteToken: room.invite_token,
        inviteLink: `${
          process.env.SERVER_URL || "https://chat-easy-integrate.onrender.com"
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

// Message operations
export async function saveMessage(roomId, username, message, messageType = 'text', fileData = null) {
  let result;
  
  if (messageType === 'file' && fileData) {
    result = await db.run(
      "INSERT INTO room_messages (room_id, username, message, message_type, file_url, file_name, file_size) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [roomId, username, message, messageType, fileData.url, fileData.fileName, fileData.size]
    );
  } else {
    result = await db.run(
      "INSERT INTO room_messages (room_id, username, message, message_type) VALUES (?, ?, ?, ?)",
      [roomId, username, message, messageType]
    );
  }

  return {
    id: result.lastID,
    roomId,
    username,
    message,
    messageType,
    fileUrl: fileData?.url,
    fileName: fileData?.fileName,
    fileSize: fileData?.size,
    timestamp: new Date(),
  };
}

export async function getRoomMessages(roomId, limit = 50) {
  const messages = await db.all(
    "SELECT * FROM room_messages WHERE room_id = ? ORDER BY timestamp DESC LIMIT ?",
    [roomId, limit]
  );

  return messages.reverse().map((msg) => ({
    id: msg.id,
    username: msg.username,
    message: msg.message,
    messageType: msg.message_type || 'text',
    fileUrl: msg.file_url,
    fileName: msg.file_name,
    fileSize: msg.file_size,
    timestamp: new Date(msg.timestamp),
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
