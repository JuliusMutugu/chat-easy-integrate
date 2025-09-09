import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Serve static files from client build
app.use(express.static('client/dist'));

// Store active rooms and users
const rooms = new Map();
const users = new Map();

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/rooms', (req, res) => {
  const { name, description, maxUsers = 10 } = req.body;
  const roomId = uuidv4();
  
  rooms.set(roomId, {
    id: roomId,
    name,
    description,
    maxUsers,
    users: new Set(),
    messages: [],
    createdAt: new Date(),
    isNegotiationActive: false
  });
  
  res.json({ roomId, name, description });
});

app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map(room => ({
    id: room.id,
    name: room.name,
    description: room.description,
    userCount: room.users.size,
    maxUsers: room.maxUsers,
    isNegotiationActive: room.isNegotiationActive,
    createdAt: room.createdAt
  }));
  
  res.json(roomList);
});

app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  res.json({
    id: room.id,
    name: room.name,
    description: room.description,
    userCount: room.users.size,
    maxUsers: room.maxUsers,
    isNegotiationActive: room.isNegotiationActive,
    createdAt: room.createdAt
  });
});

app.post('/api/rooms/:roomId/invite', (req, res) => {
  const { roomId } = req.params;
  const { inviterName, inviteMessage } = req.body;
  const room = rooms.get(roomId);
  
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  const inviteData = {
    roomId,
    roomName: room.name,
    roomDescription: room.description,
    inviterName,
    message: inviteMessage || `Join me in ${room.name}!`,
    inviteLink: `${req.protocol}://${req.get('host')}?room=${roomId}&invite=true`,
    timestamp: new Date()
  };
  
  res.json(inviteData);
});

// Socket.IO Events
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', ({ roomId, username }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.users.size >= room.maxUsers) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    // Store user info
    users.set(socket.id, { username, roomId });
    room.users.add(socket.id);
    
    socket.join(roomId);
    
    // Send existing messages to new user
    socket.emit('message-history', room.messages);
    
    // Notify room about new user
    socket.to(roomId).emit('user-joined', { username, userId: socket.id });
    
    // Send updated room info
    io.to(roomId).emit('room-update', {
      userCount: room.users.size,
      users: Array.from(room.users).map(id => users.get(id)?.username).filter(Boolean)
    });
  });

  socket.on('send-message', ({ message, type = 'text' }) => {
    const user = users.get(socket.id);
    if (!user) return;

    const room = rooms.get(user.roomId);
    if (!room) return;

    const messageData = {
      id: uuidv4(),
      username: user.username,
      message,
      type,
      timestamp: new Date(),
      userId: socket.id
    };

    room.messages.push(messageData);
    
    // Keep only last 100 messages
    if (room.messages.length > 100) {
      room.messages = room.messages.slice(-100);
    }

    io.to(user.roomId).emit('new-message', messageData);
  });

  socket.on('start-negotiation', ({ proposal }) => {
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
      startedAt: new Date()
    };

    io.to(user.roomId).emit('negotiation-started', {
      proposer: user.username,
      proposal,
      proposalId: room.currentProposal.id
    });
  });

  socket.on('vote', ({ proposalId, vote }) => {
    const user = users.get(socket.id);
    if (!user) return;

    const room = rooms.get(user.roomId);
    if (!room || !room.currentProposal || room.currentProposal.id !== proposalId) return;

    room.currentProposal.votes.set(socket.id, {
      username: user.username,
      vote,
      timestamp: new Date()
    });

    io.to(user.roomId).emit('vote-cast', {
      username: user.username,
      vote,
      totalVotes: room.currentProposal.votes.size,
      totalUsers: room.users.size
    });

    // Check if all users voted
    if (room.currentProposal.votes.size === room.users.size) {
      const votes = Array.from(room.currentProposal.votes.values());
      const approve = votes.filter(v => v.vote === 'approve').length;
      const reject = votes.filter(v => v.vote === 'reject').length;
      
      room.isNegotiationActive = false;
      
      io.to(user.roomId).emit('negotiation-completed', {
        result: approve > reject ? 'approved' : 'rejected',
        votes: { approve, reject },
        details: votes
      });
    }
  });

  socket.on('typing', ({ roomId, username }) => {
    socket.to(roomId).emit('user-typing', { username });
  });

  socket.on('stop-typing', ({ roomId, username }) => {
    socket.to(roomId).emit('user-stop-typing', { username });
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      const room = rooms.get(user.roomId);
      if (room) {
        room.users.delete(socket.id);
        socket.to(user.roomId).emit('user-left', { username: user.username });
        
        // Send updated room info
        io.to(user.roomId).emit('room-update', {
          userCount: room.users.size,
          users: Array.from(room.users).map(id => users.get(id)?.username).filter(Boolean)
        });

        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(user.roomId);
        }
      }
      users.delete(socket.id);
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Messaging platform server running on http://localhost:${PORT}`);
});
