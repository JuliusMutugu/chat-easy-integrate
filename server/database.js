import sqlite3 from "sqlite3";
import { open } from "sqlite";
import path from "path";
import crypto from "crypto";
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

    // Migration: add is_customer, is_business, kyc_status to users if missing
    const usersExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
    if (usersExists) {
      const usersCols = await db.all("PRAGMA table_info(users)");
      const usersColNames = (usersCols || []).map((c) => c.name);
      const userAddCols = [
        { name: "is_customer", type: "INTEGER DEFAULT 0" },
        { name: "is_business", type: "INTEGER DEFAULT 0" },
        { name: "kyc_status", type: "TEXT DEFAULT 'none'" },
      ];
      for (const { name, type } of userAddCols) {
        if (!usersColNames.includes(name)) {
          await db.run(`ALTER TABLE users ADD COLUMN ${name} ${type}`);
        }
      }
    }

    const roomMemberRolesExists = await db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='room_member_roles'"
    );
    if (!roomMemberRolesExists) {
      await db.exec(`
        CREATE TABLE room_member_roles (
          room_id TEXT NOT NULL,
          username TEXT NOT NULL,
          role TEXT DEFAULT 'member',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (room_id, username),
          FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE
        );
        CREATE INDEX idx_room_member_roles_room ON room_member_roles (room_id);
      `);
    }

    // Inbox/conversation meta columns on rooms
    const roomsCols = await db.all("PRAGMA table_info(rooms)");
    const colNames = (roomsCols || []).map((c) => c.name);
    const inboxCols = [
      { name: "assigned_to_username", type: "TEXT" },
      { name: "lifecycle_stage", type: "TEXT" },
      { name: "team_name", type: "TEXT" },
      { name: "channel_type", type: "TEXT DEFAULT 'chat'" },
      { name: "last_message_at", type: "DATETIME" },
      { name: "last_message_from_username", type: "TEXT" },
      { name: "last_message_preview", type: "TEXT" },
      { name: "campaign_id", type: "TEXT" },
      { name: "qualification_status", type: "TEXT" },
      { name: "qualification_notes", type: "TEXT" },
      { name: "is_best_customer", type: "INTEGER DEFAULT 0" },
      { name: "status", type: "TEXT DEFAULT 'active'" },
    ];
    for (const { name, type } of inboxCols) {
      if (!colNames.includes(name)) {
        await db.run(`ALTER TABLE rooms ADD COLUMN ${name} ${type}`);
      }
    }

    await db.exec(`
      CREATE TABLE IF NOT EXISTS workflow_config (
        template TEXT PRIMARY KEY,
        product TEXT,
        kpis TEXT,
        instructions TEXT,
        website_text TEXT,
        document_text TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        is_customer BOOLEAN DEFAULT FALSE,
        is_business BOOLEAN DEFAULT FALSE,
        kyc_status TEXT DEFAULT 'none',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      );
      CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

      CREATE TABLE IF NOT EXISTS kyc_verifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        business_name TEXT NOT NULL,
        business_registration_number TEXT,
        business_address TEXT,
        business_type TEXT,
        contact_phone TEXT,
        tax_id TEXT,
        documents_json TEXT,
        status TEXT DEFAULT 'pending',
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        reviewed_at DATETIME,
        reviewer_notes TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_kyc_user ON kyc_verifications (user_id);
      CREATE INDEX IF NOT EXISTS idx_kyc_status ON kyc_verifications (status);

      CREATE TABLE IF NOT EXISTS widget_config (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        allowed_origins TEXT,
        created_by_user_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_widget_token ON widget_config (token);
      CREATE INDEX IF NOT EXISTS idx_widget_room ON widget_config (room_id);

      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        source TEXT DEFAULT 'manual',
        status TEXT DEFAULT 'active',
        created_by_username TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns (status);

      CREATE TABLE IF NOT EXISTS icp_config (
        user_id TEXT PRIMARY KEY,
        industry TEXT,
        company_size TEXT,
        role TEXT,
        needs TEXT,
        pain_points TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS nurture_templates (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        channel TEXT DEFAULT 'email',
        subject TEXT,
        body TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_nurture_user ON nurture_templates (user_id);
    `);

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
    "SELECT COUNT(DISTINCT username) as count FROM room_users WHERE room_id = ?",
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
    assignedTo: room.assigned_to_username ?? null,
    lifecycleStage: room.lifecycle_stage ?? null,
    teamName: room.team_name ?? null,
    channelType: room.channel_type ?? "chat",
    lastMessageAt: room.last_message_at ? new Date(room.last_message_at) : null,
    lastMessageFromUsername: room.last_message_from_username ?? null,
    lastMessagePreview: room.last_message_preview ?? null,
    campaignId: room.campaign_id ?? null,
    qualificationStatus: room.qualification_status ?? null,
    qualificationNotes: room.qualification_notes ?? null,
    isBestCustomer: !!(room.is_best_customer),
    status: room.status || "active",
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

async function roomsWithCounts(roomRows) {
  return Promise.all(
    roomRows.map(async (room) => {
      const userCount = await db.get(
        "SELECT COUNT(DISTINCT username) as count FROM room_users WHERE room_id = ?",
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
        assignedTo: room.assigned_to_username ?? null,
        lifecycleStage: room.lifecycle_stage ?? null,
        teamName: room.team_name ?? null,
        channelType: room.channel_type ?? "chat",
        lastMessageAt: room.last_message_at ? new Date(room.last_message_at) : null,
        lastMessageFromUsername: room.last_message_from_username ?? null,
        lastMessagePreview: room.last_message_preview ?? null,
        campaignId: room.campaign_id ?? null,
        qualificationStatus: room.qualification_status ?? null,
        qualificationNotes: room.qualification_notes ?? null,
        isBestCustomer: !!(room.is_best_customer),
        status: room.status || "active",
      };
    })
  );
}

export async function getAllRooms() {
  const rooms = await db.all("SELECT * FROM rooms ORDER BY created_at DESC");
  return roomsWithCounts(rooms);
}

/** Rooms the user is invited to: created by them or they have joined (in room_users). */
export async function getRoomsForUser(username) {
  if (!username || typeof username !== "string" || !username.trim()) return getAllRooms();
  const rooms = await db.all(
    `SELECT DISTINCT r.* FROM rooms r
     LEFT JOIN room_users ru ON r.id = ru.room_id AND ru.username = ?
     WHERE r.created_by_username = ? OR ru.username = ?
     ORDER BY r.created_at DESC`,
    [username.trim(), username.trim(), username.trim()]
  );
  return roomsWithCounts(rooms);
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
/** If the room has no creator set, set it to this username (e.g. first joiner becomes creator). */
export async function ensureRoomCreator(roomId, username) {
  if (!roomId || !username?.trim()) return;
  await db.run(
    "UPDATE rooms SET created_by_username = ? WHERE id = ? AND (created_by_username IS NULL OR created_by_username = '')",
    [username.trim(), roomId]
  );
}

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
    // Do not delete the room when the last user leaves — rooms persist in the DB
    // until explicitly deleted (e.g. by creator). This ensures rooms are not lost on disconnect.
    return user;
  }
  return null;
}

export async function getRoomUsers(roomId) {
  const users = await db.all(
    "SELECT DISTINCT username FROM room_users WHERE room_id = ? ORDER BY username",
    [roomId]
  );
  return users.map(u => u.username);
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

/** All pending join requests for rooms created by this username */
export async function getPendingJoinRequestsForCreator(creatorUsername) {
  if (!creatorUsername) return [];
  const rows = await db.all(
    `SELECT p.id, p.room_id, p.requester_username, p.requester_socket_id, p.created_at, r.name AS room_name
     FROM pending_join_requests p
     JOIN rooms r ON r.id = p.room_id
     WHERE r.created_by_username = ? AND p.status = 'pending'
     ORDER BY p.created_at DESC`,
    [creatorUsername]
  );
  return rows.map((r) => ({
    requestId: r.id,
    roomId: r.room_id,
    roomName: r.room_name,
    requesterUsername: r.requester_username,
    requesterSocketId: r.requester_socket_id,
    createdAt: r.created_at,
  }));
}

// Message operations
function lastMessagePreview(msg) {
  if (typeof msg !== "string") return "";
  try {
    const p = JSON.parse(msg);
    const t = p.message || p.text || p.body || msg;
    return String(t).slice(0, 120);
  } catch (_) {
    return msg.slice(0, 120);
  }
}

export async function saveMessage(roomId, username, message, replyToMessageId = null) {
  const result = await db.run(
    "INSERT INTO room_messages (room_id, username, message, reply_to_message_id) VALUES (?, ?, ?, ?)",
    [roomId, username, message, replyToMessageId]
  );

  const preview = lastMessagePreview(message);
  await db.run(
    `UPDATE rooms SET last_message_at = CURRENT_TIMESTAMP, last_message_from_username = ?, last_message_preview = ? WHERE id = ?`,
    [username, preview || null, roomId]
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

/** Update room inbox meta (assigned to, lifecycle, team, channel type, campaign, qualification, best customer, status). */
export async function updateRoomMeta(roomId, { assignedTo, lifecycleStage, teamName, channelType, campaignId, qualificationStatus, qualificationNotes, isBestCustomer, status }) {
  const room = await db.get("SELECT id FROM rooms WHERE id = ?", [roomId]);
  if (!room) return null;

  const updates = [];
  const values = [];
  if (assignedTo !== undefined) {
    updates.push("assigned_to_username = ?");
    values.push(assignedTo === "" || assignedTo == null ? null : assignedTo);
  }
  if (lifecycleStage !== undefined) {
    updates.push("lifecycle_stage = ?");
    values.push(lifecycleStage === "" || lifecycleStage == null ? null : lifecycleStage);
  }
  if (teamName !== undefined) {
    updates.push("team_name = ?");
    values.push(teamName === "" || teamName == null ? null : teamName);
  }
  if (channelType !== undefined) {
    updates.push("channel_type = ?");
    values.push(channelType === "" || channelType == null ? "chat" : channelType);
  }
  if (campaignId !== undefined) {
    updates.push("campaign_id = ?");
    values.push(campaignId === "" || campaignId == null ? null : campaignId);
  }
  if (qualificationStatus !== undefined) {
    updates.push("qualification_status = ?");
    values.push(qualificationStatus === "" || qualificationStatus == null ? null : qualificationStatus);
  }
  if (qualificationNotes !== undefined) {
    updates.push("qualification_notes = ?");
    values.push(qualificationNotes === "" || qualificationNotes == null ? null : qualificationNotes);
  }
  if (isBestCustomer !== undefined) {
    updates.push("is_best_customer = ?");
    values.push(isBestCustomer ? 1 : 0);
  }
  if (status !== undefined) {
    updates.push("status = ?");
    values.push(status === "" || status == null ? "active" : status);
  }
  if (updates.length === 0) return getRoomById(roomId);
  values.push(roomId);
  await db.run(`UPDATE rooms SET ${updates.join(", ")} WHERE id = ?`, values);
  return getRoomById(roomId);
}

/** Workflow config (agent templates: sales-engineer, marketing-engineer, receptionist, chat-widget). */
const WORKFLOW_TEMPLATES = ["sales-engineer", "marketing-engineer", "receptionist", "chat-widget"];

export async function getWorkflowConfig(template) {
  if (!WORKFLOW_TEMPLATES.includes(template)) return null;
  const row = await db.get("SELECT * FROM workflow_config WHERE template = ?", [template]);
  if (!row) return null;
  return {
    product: row.product ?? "",
    kpis: row.kpis ?? "",
    instructions: row.instructions ?? "",
    websiteText: row.website_text ?? "",
    documentText: row.document_text ?? "",
    updatedAt: row.updated_at ? new Date(row.updated_at) : null,
  };
}

export async function setWorkflowConfig(template, data) {
  if (!WORKFLOW_TEMPLATES.includes(template)) return null;
  const product = (data?.product ?? "").trim();
  const kpis = (data?.kpis ?? "").trim();
  const instructions = (data?.instructions ?? "").trim();
  const websiteText = (data?.websiteText ?? "").trim();
  const documentText = (data?.documentText ?? "").trim();
  await db.run(
    `INSERT INTO workflow_config (template, product, kpis, instructions, website_text, document_text, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(template) DO UPDATE SET
       product = excluded.product,
       kpis = excluded.kpis,
       instructions = excluded.instructions,
       website_text = excluded.website_text,
       document_text = excluded.document_text,
       updated_at = CURRENT_TIMESTAMP`,
    [template, product, kpis, instructions, websiteText, documentText]
  );
  return getWorkflowConfig(template);
}

/** User authentication */
function generateUserId() {
  return "u-" + Date.now() + "-" + Math.random().toString(36).slice(2, 11);
}

export async function createUser(email, passwordHash, name, { isCustomer = false, isBusiness = false } = {}) {
  const userId = generateUserId();
  const kycStatus = isBusiness ? "pending" : "none";
  await db.run(
    "INSERT INTO users (id, email, password_hash, name, is_customer, is_business, kyc_status) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [userId, email.toLowerCase().trim(), passwordHash, name.trim(), isCustomer ? 1 : 0, isBusiness ? 1 : 0, kycStatus]
  );
  return getUserById(userId);
}

export async function getUserById(userId) {
  const user = await db.get("SELECT * FROM users WHERE id = ?", [userId]);
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isCustomer: !!user.is_customer,
    isBusiness: !!user.is_business,
    kycStatus: user.kyc_status || "none",
    createdAt: user.created_at ? new Date(user.created_at) : null,
    lastLogin: user.last_login ? new Date(user.last_login) : null,
  };
}

export async function getUserByEmail(email) {
  const user = await db.get("SELECT * FROM users WHERE email = ?", [email.toLowerCase().trim()]);
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    passwordHash: user.password_hash,
    isCustomer: !!user.is_customer,
    isBusiness: !!user.is_business,
    kycStatus: user.kyc_status || "none",
    createdAt: user.created_at ? new Date(user.created_at) : null,
    lastLogin: user.last_login ? new Date(user.last_login) : null,
  };
}

export async function updateUserLastLogin(userId) {
  await db.run("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [userId]);
}

export async function updateUserKycStatus(userId, status) {
  await db.run("UPDATE users SET kyc_status = ? WHERE id = ?", [status, userId]);
}

/** KYC Verifications */
export async function submitKyc(userId, data) {
  const { businessName, registrationNumber, address, businessType, contactPhone, taxId, documents } = data;
  await db.run(
    `INSERT INTO kyc_verifications (user_id, business_name, business_registration_number, business_address, business_type, contact_phone, tax_id, documents_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, businessName, registrationNumber || null, address || null, businessType || null, contactPhone || null, taxId || null, documents ? JSON.stringify(documents) : null]
  );
  await updateUserKycStatus(userId, "submitted");
  return getKycByUserId(userId);
}

export async function getKycByUserId(userId) {
  const kyc = await db.get("SELECT * FROM kyc_verifications WHERE user_id = ? ORDER BY submitted_at DESC LIMIT 1", [userId]);
  if (!kyc) return null;
  return {
    id: kyc.id,
    userId: kyc.user_id,
    businessName: kyc.business_name,
    registrationNumber: kyc.business_registration_number,
    address: kyc.business_address,
    businessType: kyc.business_type,
    contactPhone: kyc.contact_phone,
    taxId: kyc.tax_id,
    documents: kyc.documents_json ? JSON.parse(kyc.documents_json) : null,
    status: kyc.status,
    submittedAt: kyc.submitted_at ? new Date(kyc.submitted_at) : null,
    reviewedAt: kyc.reviewed_at ? new Date(kyc.reviewed_at) : null,
    reviewerNotes: kyc.reviewer_notes,
  };
}

export async function updateKycStatus(kycId, status, reviewerNotes = null) {
  await db.run(
    "UPDATE kyc_verifications SET status = ?, reviewed_at = CURRENT_TIMESTAMP, reviewer_notes = ? WHERE id = ?",
    [status, reviewerNotes, kycId]
  );
  const kyc = await db.get("SELECT user_id FROM kyc_verifications WHERE id = ?", [kycId]);
  if (kyc) {
    await updateUserKycStatus(kyc.user_id, status);
  }
}

/** Widget SDK – embeddable chat widget config */
function generateWidgetId() {
  return "wg-" + Date.now() + "-" + Math.random().toString(36).slice(2, 11);
}

function generateWidgetToken() {
  return "nego_" + crypto.randomBytes(24).toString("hex");
}

export async function createWidgetConfig(roomId, createdByUserId, allowedOrigins = "*") {
  const id = generateWidgetId();
  const token = generateWidgetToken();
  const origins = typeof allowedOrigins === "string" ? allowedOrigins : (Array.isArray(allowedOrigins) ? allowedOrigins.join(",") : "*");
  await db.run(
    "INSERT INTO widget_config (id, room_id, token, allowed_origins, created_by_user_id) VALUES (?, ?, ?, ?, ?)",
    [id, roomId, token, origins, createdByUserId || null]
  );
  return getWidgetConfigById(id);
}

export async function getWidgetConfigById(id) {
  const row = await db.get("SELECT * FROM widget_config WHERE id = ?", [id]);
  return row ? { id: row.id, roomId: row.room_id, token: row.token, allowedOrigins: row.allowed_origins || "*", createdAt: row.created_at } : null;
}

export async function getWidgetConfigByToken(token) {
  const row = await db.get("SELECT * FROM widget_config WHERE token = ?", [token]);
  if (!row) return null;
  const room = await getRoomById(row.room_id);
  if (!room) return null;
  return {
    id: row.id,
    roomId: row.room_id,
    token: row.token,
    allowedOrigins: row.allowed_origins || "*",
    room: { id: room.id, name: room.name, description: room.description, code: room.code },
  };
}

export async function getWidgetConfigsForRoom(roomId) {
  const rows = await db.all("SELECT * FROM widget_config WHERE room_id = ? ORDER BY created_at DESC", [roomId]);
  return rows.map((r) => ({ id: r.id, roomId: r.room_id, token: r.token, allowedOrigins: r.allowed_origins || "*", createdAt: r.created_at }));
}

export async function deleteWidgetConfig(id) {
  await db.run("DELETE FROM widget_config WHERE id = ?", [id]);
}

/** Campaigns – gather and manage leads */
function generateCampaignId() {
  return "camp-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
}

export async function createCampaign({ name, description, source = "manual", createdByUsername }) {
  const id = generateCampaignId();
  await db.run(
    "INSERT INTO campaigns (id, name, description, source, status, created_by_username) VALUES (?, ?, ?, ?, 'active', ?)",
    [id, name, description || null, source, createdByUsername || null]
  );
  return getCampaignById(id);
}

export async function getCampaignById(id) {
  const row = await db.get("SELECT * FROM campaigns WHERE id = ?", [id]);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    source: row.source || "manual",
    status: row.status || "active",
    createdByUsername: row.created_by_username,
    createdAt: row.created_at ? new Date(row.created_at) : null,
  };
}

export async function getAllCampaigns() {
  const rows = await db.all("SELECT * FROM campaigns ORDER BY created_at DESC");
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    source: r.source || "manual",
    status: r.status || "active",
    createdByUsername: r.created_by_username,
    createdAt: r.created_at ? new Date(r.created_at) : null,
  }));
}

export async function updateCampaign(id, { name, description, source, status }) {
  const existing = await db.get("SELECT id FROM campaigns WHERE id = ?", [id]);
  if (!existing) return null;
  const updates = [];
  const values = [];
  if (name !== undefined) { updates.push("name = ?"); values.push(name); }
  if (description !== undefined) { updates.push("description = ?"); values.push(description); }
  if (source !== undefined) { updates.push("source = ?"); values.push(source); }
  if (status !== undefined) { updates.push("status = ?"); values.push(status); }
  if (updates.length === 0) return getCampaignById(id);
  values.push(id);
  await db.run(`UPDATE campaigns SET ${updates.join(", ")} WHERE id = ?`, values);
  return getCampaignById(id);
}

export async function deleteCampaign(id) {
  await db.run("UPDATE rooms SET campaign_id = NULL WHERE campaign_id = ?", [id]);
  await db.run("DELETE FROM campaigns WHERE id = ?", [id]);
}

/** Get message count for a room (for engagement scoring) */
export async function getRoomMessageCount(roomId) {
  const row = await db.get("SELECT COUNT(*) as count FROM room_messages WHERE room_id = ?", [roomId]);
  return row?.count ?? 0;
}

/** Compute engagement score 0–100 from message count + recency */
function computeEngagementScore(messageCount, lastMessageAt) {
  let score = Math.min(50, messageCount * 5); // up to 50 from message count
  if (lastMessageAt) {
    const hoursSince = (Date.now() - new Date(lastMessageAt).getTime()) / 3600000;
    if (hoursSince < 1) score += 30;
    else if (hoursSince < 24) score += 20;
    else if (hoursSince < 72) score += 10;
  }
  return Math.min(100, Math.round(score));
}

/** Extract keywords from text (min 2 chars, filter common words) */
function extractKeywords(text) {
  if (!text || typeof text !== "string") return [];
  const stop = new Set(["the", "and", "for", "with", "from", "that", "this", "are", "was", "have", "has", "your", "our", "you", "to", "of", "in", "a", "an", "is", "it", "or", "be", "on", "at", "as"]);
  return text
    .toLowerCase()
    .replace(/[,;.!?()]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stop.has(w));
}

/** Compute ICP fit score 0–100 from keyword overlap between ICP and lead text */
function computeIcpFitScore(icp, room) {
  if (!icp || (!icp.industry && !icp.companySize && !icp.role && !icp.needs && !icp.painPoints)) return null;
  const icpText = [icp.industry, icp.companySize, icp.role, icp.needs, icp.painPoints].filter(Boolean).join(" ");
  const icpKeywords = [...new Set(extractKeywords(icpText))];
  if (icpKeywords.length === 0) return null;
  const leadText = [room.name, room.description, room.lastMessagePreview].filter(Boolean).join(" ");
  const leadWords = extractKeywords(leadText);
  if (leadWords.length === 0) return 0;
  const matches = icpKeywords.filter((k) => leadWords.some((w) => w.includes(k) || k.includes(w)));
  const ratio = matches.length / icpKeywords.length;
  return Math.min(100, Math.round(ratio * 100));
}

/** ICP config – ideal customer profile */
export async function getIcpConfigByUserId(userId) {
  const row = await db.get("SELECT * FROM icp_config WHERE user_id = ?", [userId]);
  return row
    ? {
        industry: row.industry || "",
        companySize: row.company_size || "",
        role: row.role || "",
        needs: row.needs || "",
        painPoints: row.pain_points || "",
        updatedAt: row.updated_at ? new Date(row.updated_at) : null,
      }
    : null;
}

export async function setIcpConfig(userId, { industry, companySize, role, needs, painPoints }) {
  await db.run(
    `INSERT INTO icp_config (user_id, industry, company_size, role, needs, pain_points, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET
       industry = excluded.industry,
       company_size = excluded.company_size,
       role = excluded.role,
       needs = excluded.needs,
       pain_points = excluded.pain_points,
       updated_at = CURRENT_TIMESTAMP`,
    [
      userId,
      industry ?? "",
      companySize ?? "",
      role ?? "",
      needs ?? "",
      painPoints ?? "",
    ]
  );
  return getIcpConfigByUserId(userId);
}

/** Get leads for a campaign: rooms + pending join requests for those rooms */
export async function getLeadsForCampaign(campaignId, username, userId = null) {
  const roomRows = await db.all(
    "SELECT * FROM rooms WHERE campaign_id = ? ORDER BY created_at DESC, last_message_at DESC",
    [campaignId]
  );
  const rooms = await roomsWithCounts(roomRows);
  const icp = userId ? await getIcpConfigByUserId(userId) : null;
  for (const room of rooms) {
    const msgCount = await getRoomMessageCount(room.id);
    room.engagementScore = computeEngagementScore(msgCount, room.lastMessageAt);
    room.icpFitScore = computeIcpFitScore(icp, room);
  }
  const pending = await db.all(
    `SELECT p.*, r.name as room_name FROM pending_join_requests p
     JOIN rooms r ON p.room_id = r.id
     WHERE r.campaign_id = ? AND p.status = 'pending'
     ORDER BY p.created_at DESC`,
    [campaignId]
  );
  return {
    rooms,
    pending: pending.map((p) => ({
      requestId: p.id,
      roomId: p.room_id,
      roomName: p.room_name,
      requesterUsername: p.requester_username,
      createdAt: p.created_at ? new Date(p.created_at) : null,
    })),
  };
}

/** Nurture templates */
export async function createNurtureTemplate(userId, { name, channel, subject, body }) {
  const id = "nt-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
  await db.run(
    "INSERT INTO nurture_templates (id, user_id, name, channel, subject, body) VALUES (?, ?, ?, ?, ?, ?)",
    [id, userId, name || "Untitled", channel || "email", subject || "", body || ""]
  );
  return db.get("SELECT * FROM nurture_templates WHERE id = ?", [id]);
}

export async function getNurtureTemplatesByUserId(userId) {
  const rows = await db.all("SELECT * FROM nurture_templates WHERE user_id = ? ORDER BY created_at DESC", [userId]);
  return rows.map((r) => ({ id: r.id, name: r.name, channel: r.channel, subject: r.subject, body: r.body, createdAt: r.created_at }));
}

export async function deleteNurtureTemplate(id, userId) {
  await db.run("DELETE FROM nurture_templates WHERE id = ? AND user_id = ?", [id, userId]);
}

/** Find leads similar to best customers (same source, similar engagement) */
export async function getSimilarLeads(username, userId = null, limit = 10) {
  const bestRows = await db.all(
    `SELECT r.*, c.source as campaign_source FROM rooms r
     LEFT JOIN campaigns c ON r.campaign_id = c.id
     WHERE r.is_best_customer = 1
     AND (r.created_by_username = ? OR EXISTS (SELECT 1 FROM room_users ru WHERE ru.room_id = r.id AND ru.username = ?))`,
    [username || "", username || ""]
  );
  const bestIds = new Set(bestRows.map((r) => r.id));
  const sources = [...new Set(bestRows.map((r) => (r.campaign_source || "manual").trim() || "manual"))];
  const sourceSet = sources.length > 0 ? new Set(sources) : new Set(["manual", "widget", "invite", "form"]);

  const candidateRows = await db.all(
    `SELECT r.*, c.source as campaign_source FROM rooms r
     LEFT JOIN campaigns c ON r.campaign_id = c.id
     WHERE r.is_best_customer = 0
     AND (r.created_by_username = ? OR EXISTS (SELECT 1 FROM room_users ru WHERE ru.room_id = r.id AND ru.username = ?))`,
    [username || "", username || ""]
  );

  const matching = candidateRows.filter((r) => {
    const src = (r.campaign_source || "manual").trim() || "manual";
    return sourceSet.has(src);
  });

  const rooms = await roomsWithCounts(matching);
  for (const room of rooms) {
    const msgCount = await getRoomMessageCount(room.id);
    room.engagementScore = computeEngagementScore(msgCount, room.lastMessageAt);
    const icp = userId ? await getIcpConfigByUserId(userId) : null;
    room.icpFitScore = computeIcpFitScore(icp, room);
  }
  rooms.sort((a, b) => (b.engagementScore ?? 0) - (a.engagementScore ?? 0));
  return rooms.slice(0, limit);
}

/** Get campaign/source analytics for a user */
export async function getCampaignAnalytics(username) {
  const campaigns = await db.all(
    "SELECT * FROM campaigns WHERE created_by_username = ? ORDER BY created_at DESC",
    [username || ""]
  );
  const byCampaign = [];
  const bySource = {};

  for (const camp of campaigns) {
    const rooms = await db.all(
      "SELECT id, lifecycle_stage FROM rooms WHERE campaign_id = ?",
      [camp.id]
    );
    const stats = {
      total: rooms.length,
      new_lead: rooms.filter((r) => r.lifecycle_stage === "new_lead").length,
      hot_lead: rooms.filter((r) => r.lifecycle_stage === "hot_lead").length,
      payment: rooms.filter((r) => r.lifecycle_stage === "payment").length,
      customer: rooms.filter((r) => r.lifecycle_stage === "customer").length,
    };
    stats.converted = stats.payment + stats.customer;
    stats.conversionRate = stats.total > 0 ? Math.round((stats.converted / stats.total) * 100) : 0;

    byCampaign.push({
      id: camp.id,
      name: camp.name,
      source: camp.source || "manual",
      ...stats,
      createdAt: camp.created_at ? new Date(camp.created_at) : null,
    });

    const src = camp.source || "manual";
    if (!bySource[src]) {
      bySource[src] = { total: 0, new_lead: 0, hot_lead: 0, payment: 0, customer: 0, converted: 0, campaigns: 0 };
    }
    bySource[src].total += stats.total;
    bySource[src].new_lead += stats.new_lead;
    bySource[src].hot_lead += stats.hot_lead;
    bySource[src].payment += stats.payment;
    bySource[src].customer += stats.customer;
    bySource[src].converted += stats.converted;
    bySource[src].campaigns += 1;
  }

  const sourceSummary = Object.entries(bySource).map(([source, s]) => ({
    source,
    ...s,
    conversionRate: s.total > 0 ? Math.round((s.converted / s.total) * 100) : 0,
  })).sort((a, b) => b.total - a.total);

  return { byCampaign, bySource: sourceSummary };
}

/** Get all leads (rooms with lifecycle new_lead/hot_lead or any campaign room) – for "All leads" view */
export async function getAllLeads(username, userId = null) {
  let rooms = await getRoomsForUser(username);
  rooms = rooms.filter((r) => r.lifecycleStage === "new_lead" || r.lifecycleStage === "hot_lead" || r.campaignId);
  const icp = userId ? await getIcpConfigByUserId(userId) : null;
  for (const room of rooms) {
    const msgCount = await getRoomMessageCount(room.id);
    room.engagementScore = computeEngagementScore(msgCount, room.lastMessageAt);
    room.icpFitScore = computeIcpFitScore(icp, room);
  }
  const pending = await db.all(
    `SELECT p.*, r.name as room_name FROM pending_join_requests p
     JOIN rooms r ON p.room_id = r.id
     WHERE p.status = 'pending'
     AND (r.created_by_username = ? OR EXISTS (SELECT 1 FROM room_users ru WHERE ru.room_id = r.id AND ru.username = ?))
     ORDER BY p.created_at DESC`,
    [username || "", username || ""]
  );
  return {
    rooms,
    pending: pending.map((p) => ({
      requestId: p.id,
      roomId: p.room_id,
      roomName: p.room_name,
      requesterUsername: p.requester_username,
      createdAt: p.created_at ? new Date(p.created_at) : null,
    })),
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
        payload = {
          price: parsed.price, qty: parsed.qty, slaDays: parsed.slaDays, sla: parsed.sla,
          subtotal: parsed.subtotal, tax: parsed.tax, shipping: parsed.shipping, total: parsed.total,
          taxRatePct: parsed.taxRatePct, shippingFlat: parsed.shippingFlat, marginPct: parsed.marginPct, margin: parsed.margin,
          versionCount: parsed.versionCount, versionEvents: parsed.versionEvents
        };
      } else if (parsed.type === "document") {
        type = "document";
        message = parsed.text || parsed.filename || message;
        payload = { url: parsed.url, filename: parsed.filename };
      } else if (parsed.type === "redline") {
        type = "redline";
        message = parsed.text || parsed.message || message;
        payload = { original: parsed.original, suggested: parsed.suggested };
      } else if (parsed.type === "signature") {
        type = "signature";
        message = parsed.text || "Signature";
        payload = { imageUrl: parsed.imageUrl, label: parsed.label };
      } else if (parsed.type === "payment_request") {
        type = "payment_request";
        message = parsed.text || "Payment request";
        payload = { amount: parsed.amount, currency: parsed.currency, gateway: parsed.gateway, reference: parsed.reference };
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

// Room member roles (RBAC: member, manager)
export async function getRoomMemberRoles(roomId) {
  const rows = await db.all(
    "SELECT room_id, username, role FROM room_member_roles WHERE room_id = ?",
    [roomId]
  );
  return rows.map((r) => ({ roomId: r.room_id, username: r.username, role: r.role }));
}

export async function setRoomMemberRole(roomId, username, role) {
  await db.run(
    "INSERT OR REPLACE INTO room_member_roles (room_id, username, role) VALUES (?, ?, ?)",
    [roomId, username, role]
  );
  return getRoomMemberRoles(roomId);
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
