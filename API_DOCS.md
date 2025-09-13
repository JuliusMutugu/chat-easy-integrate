# 🔌 API Integration Documentation

## Base URL
```
Production: https://chat-easy-integrate.onrender.com
Local: http://localhost:3000
```

## Authentication
Currently, the API uses room codes and invite tokens for access control. Future versions will include API keys and user authentication.

## 📡 REST API Endpoints

### 1. Room Management

#### Create Room
```http
POST /api/rooms
Content-Type: application/json

{
    "name": "Project Alpha Discussion",
    "description": "Team chat for Project Alpha",
    "maxUsers": 10
}
```

**Response:**
```json
{
    "roomId": "uuid-room-id",
    "roomCode": 123456,
    "name": "Project Alpha Discussion",
    "description": "Team chat for Project Alpha",
    "maxUsers": 10,
    "userCount": 0,
    "inviteToken": "secure-invite-token",
    "inviteLink": "https://chat-easy-integrate.onrender.com/invite/secure-invite-token"
}
```

#### Get Room by ID
```http
GET /api/rooms/{roomId}
```

**Response:**
```json
{
    "id": "uuid-room-id",
    "code": 123456,
    "name": "Project Alpha Discussion",
    "description": "Team chat for Project Alpha",
    "maxUsers": 10,
    "userCount": 3,
    "createdAt": "2025-09-13T10:00:00Z"
}
```

#### Get Room by Code
```http
GET /api/rooms/code/{roomCode}
```

#### Get Room by Invite Token
```http
GET /api/rooms/invite/{inviteToken}
```

#### Generate New Invite Link
```http
POST /api/rooms/{roomId}/invite
```

**Response:**
```json
{
    "inviteToken": "new-secure-token",
    "inviteLink": "https://chat-easy-integrate.onrender.com/invite/new-secure-token"
}
```

#### List All Rooms
```http
GET /api/rooms
```

**Response:**
```json
{
    "rooms": [
        {
            "id": "uuid-1",
            "code": 123456,
            "name": "Room 1",
            "userCount": 3,
            "maxUsers": 10
        }
    ]
}
```

### 2. Health Check
```http
GET /api/health
```

**Response:**
```json
{
    "status": "ok",
    "timestamp": "2025-09-13T10:00:00Z"
}
```

## 🔌 WebSocket Integration

### Connection
```javascript
import { io } from 'socket.io-client';

const socket = io('https://chat-easy-integrate.onrender.com');

// Join a room
socket.emit('join-room', {
    roomId: 'your-room-id',
    username: 'John Doe'
});
```

### Events

#### Client to Server Events

##### Join Room
```javascript
socket.emit('join-room', {
    roomId: 'uuid-room-id',
    username: 'John Doe'
});
```

##### Send Message
```javascript
socket.emit('send-message', {
    roomId: 'uuid-room-id',
    message: 'Hello everyone!',
    type: 'text' // 'text' | 'location' | 'file'
});
```

##### Send Location
```javascript
socket.emit('send-message', {
    roomId: 'uuid-room-id',
    message: 'Sharing my location',
    type: 'location',
    location: {
        latitude: 40.7128,
        longitude: -74.0060,
        accuracy: 10
    }
});
```

##### Start Negotiation
```javascript
socket.emit('start-negotiation', {
    roomId: 'uuid-room-id',
    proposal: 'Should we extend the deadline by 2 weeks?'
});
```

##### Vote on Negotiation
```javascript
socket.emit('vote-negotiation', {
    roomId: 'uuid-room-id',
    negotiationId: 'negotiation-uuid',
    vote: 'approve' // 'approve' | 'reject'
});
```

##### Typing Indicator
```javascript
socket.emit('typing-start', { roomId: 'uuid-room-id' });
socket.emit('typing-stop', { roomId: 'uuid-room-id' });
```

##### Leave Room
```javascript
socket.emit('leave-room', { roomId: 'uuid-room-id' });
```

#### Server to Client Events

##### Room Joined
```javascript
socket.on('room-joined', (data) => {
    console.log('Joined room:', data);
    // { roomId, username, userCount }
});
```

##### New Message
```javascript
socket.on('new-message', (message) => {
    console.log('New message:', message);
    /*
    {
        id: 'message-uuid',
        username: 'John Doe',
        message: 'Hello!',
        type: 'text',
        timestamp: '2025-09-13T10:00:00Z',
        location?: { latitude, longitude, accuracy }
    }
    */
});
```

##### User Joined/Left
```javascript
socket.on('user-joined', (data) => {
    console.log('User joined:', data);
    // { username, userCount }
});

socket.on('user-left', (data) => {
    console.log('User left:', data);
    // { username, userCount }
});
```

##### Negotiation Events
```javascript
socket.on('negotiation-started', (negotiation) => {
    console.log('Negotiation started:', negotiation);
    /*
    {
        id: 'negotiation-uuid',
        proposal: 'Should we extend the deadline?',
        startedBy: 'John Doe',
        timestamp: '2025-09-13T10:00:00Z'
    }
    */
});

socket.on('negotiation-vote', (voteData) => {
    console.log('New vote:', voteData);
    /*
    {
        negotiationId: 'negotiation-uuid',
        voter: 'Jane Doe',
        vote: 'approve',
        totalVotes: { approve: 2, reject: 1 }
    }
    */
});

socket.on('negotiation-ended', (result) => {
    console.log('Negotiation ended:', result);
    /*
    {
        negotiationId: 'negotiation-uuid',
        result: 'approved', // 'approved' | 'rejected'
        finalVotes: { approve: 3, reject: 1 }
    }
    */
});
```

##### Typing Indicators
```javascript
socket.on('user-typing', (data) => {
    console.log('User typing:', data);
    // { username }
});

socket.on('user-stopped-typing', (data) => {
    console.log('User stopped typing:', data);
    // { username }
});
```

## 🔗 Integration Examples

### 1. Backend Integration (Node.js/Express)

```javascript
import express from 'express';
import fetch from 'node-fetch';

const app = express();

// Create a chat room for a project
app.post('/projects/:id/chat', async (req, res) => {
    const { id } = req.params;
    const project = await getProject(id);
    
    // Create room in messaging platform
    const response = await fetch('https://chat-easy-integrate.onrender.com/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: `${project.name} Team Chat`,
            description: `Discussion room for ${project.name}`,
            maxUsers: project.teamSize + 5
        })
    });
    
    const chatRoom = await response.json();
    
    // Save room info to your database
    await updateProject(id, {
        chatRoomId: chatRoom.roomId,
        chatRoomCode: chatRoom.roomCode,
        inviteLink: chatRoom.inviteLink
    });
    
    res.json({
        success: true,
        chatRoom: {
            roomCode: chatRoom.roomCode,
            inviteLink: chatRoom.inviteLink
        }
    });
});

// Get chat room for a project
app.get('/projects/:id/chat', async (req, res) => {
    const { id } = req.params;
    const project = await getProject(id);
    
    if (!project.chatRoomId) {
        return res.status(404).json({ error: 'No chat room found' });
    }
    
    // Get room info from messaging platform
    const response = await fetch(`https://chat-easy-integrate.onrender.com/api/rooms/${project.chatRoomId}`);
    const chatRoom = await response.json();
    
    res.json(chatRoom);
});
```

### 2. Frontend Integration with API

```javascript
class ChatAPI {
    constructor(baseUrl = 'https://chat-easy-integrate.onrender.com') {
        this.baseUrl = baseUrl;
    }
    
    async createRoom(roomData) {
        const response = await fetch(`${this.baseUrl}/api/rooms`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(roomData)
        });
        return response.json();
    }
    
    async getRoomByCode(code) {
        const response = await fetch(`${this.baseUrl}/api/rooms/code/${code}`);
        return response.json();
    }
    
    async generateInviteLink(roomId) {
        const response = await fetch(`${this.baseUrl}/api/rooms/${roomId}/invite`, {
            method: 'POST'
        });
        return response.json();
    }
}

// Usage
const chatAPI = new ChatAPI();

// Create a room for your application
const room = await chatAPI.createRoom({
    name: 'Customer Support',
    description: 'Get help from our team',
    maxUsers: 10
});

// Open chat widget with the created room
openChatWidget(`${chatAPI.baseUrl}?roomCode=${room.roomCode}`);
```

### 3. React Hook for Chat Integration

```javascript
import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

export const useChat = (roomId, username) => {
    const [socket, setSocket] = useState(null);
    const [messages, setMessages] = useState([]);
    const [users, setUsers] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    
    useEffect(() => {
        const newSocket = io('https://chat-easy-integrate.onrender.com');
        
        newSocket.on('connect', () => {
            setIsConnected(true);
            newSocket.emit('join-room', { roomId, username });
        });
        
        newSocket.on('new-message', (message) => {
            setMessages(prev => [...prev, message]);
        });
        
        newSocket.on('user-joined', (data) => {
            setUsers(prev => [...prev, data.username]);
        });
        
        newSocket.on('user-left', (data) => {
            setUsers(prev => prev.filter(user => user !== data.username));
        });
        
        setSocket(newSocket);
        
        return () => newSocket.close();
    }, [roomId, username]);
    
    const sendMessage = (message) => {
        if (socket && isConnected) {
            socket.emit('send-message', { roomId, message, type: 'text' });
        }
    };
    
    return {
        messages,
        users,
        sendMessage,
        isConnected
    };
};

// Usage in component
function ChatComponent({ roomId, username }) {
    const { messages, users, sendMessage, isConnected } = useChat(roomId, username);
    
    return (
        <div>
            <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
            <div>Users: {users.join(', ')}</div>
            <div>
                {messages.map(msg => (
                    <div key={msg.id}>{msg.username}: {msg.message}</div>
                ))}
            </div>
            <button onClick={() => sendMessage('Hello!')}>
                Send Message
            </button>
        </div>
    );
}
```

## 📊 Rate Limits & Best Practices

### Rate Limits
- **API Endpoints**: 100 requests per minute per IP
- **WebSocket Messages**: 60 messages per minute per connection
- **Room Creation**: 10 rooms per hour per IP

### Best Practices

1. **Connection Management**
   ```javascript
   // Reconnect on disconnect
   socket.on('disconnect', () => {
       setTimeout(() => {
           socket.connect();
       }, 1000);
   });
   ```

2. **Error Handling**
   ```javascript
   socket.on('error', (error) => {
       console.error('Socket error:', error);
       // Handle error appropriately
   });
   ```

3. **Message Queuing**
   ```javascript
   const messageQueue = [];
   
   socket.on('connect', () => {
       // Send queued messages
       messageQueue.forEach(msg => socket.emit('send-message', msg));
       messageQueue.length = 0;
   });
   ```

## 🔒 Security Considerations

1. **Validate all inputs** before sending to the API
2. **Use HTTPS** in production
3. **Implement rate limiting** on your side
4. **Sanitize user messages** to prevent XSS
5. **Use room codes** for access control

## 🚀 Deployment Integration

### Environment Variables
```bash
# Your application's .env
CHAT_PLATFORM_URL=https://chat-easy-integrate.onrender.com
CHAT_API_KEY=your-api-key-here  # Future feature
```

### Docker Integration
```dockerfile
# Add to your Dockerfile
ENV CHAT_PLATFORM_URL=https://chat-easy-integrate.onrender.com
```

## 📈 Analytics & Monitoring

### Track Chat Events
```javascript
// Track when users open chat
function trackChatOpen(roomId) {
    analytics.track('Chat Opened', { roomId });
}

// Track message sending
socket.on('new-message', (message) => {
    analytics.track('Message Sent', {
        roomId: message.roomId,
        messageType: message.type
    });
});
```

---

## 🆘 Support & Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure your domain is allowed
2. **Connection Issues**: Check WebSocket support
3. **Rate Limiting**: Implement proper queuing
4. **Message Delivery**: Handle offline scenarios

### Debug Mode
Add `?debug=true` to any URL for verbose logging.

### Contact
- API Issues: Check server logs
- Integration Help: Review examples above
- Feature Requests: Submit via GitHub issues

---

*This API is designed to be simple yet powerful, allowing you to integrate real-time messaging into any application with minimal effort.*
