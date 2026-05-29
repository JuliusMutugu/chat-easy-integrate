# Simple Messaging Platform 💬

A lightweight, embeddable messaging module for group negotiations and temporary conversations. Built with Node.js and Svelte 5 for easy integration into any application.

## ✨ Features

- 🏠 **Room Management** - Create and join chat rooms
- 💬 **Real-time Messaging** - Instant communication with Socket.IO
- 🤝 **Group Negotiation** - Built-in voting system for group decisions
- 👥 **User Presence** - See who's online in each room
- 📱 **Responsive Design** - Works on desktop and mobile
- 🔧 **Easy Integration** - Simple component-based architecture

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

1. **Install dependencies:**

   ```bash
   npm run install-all
   ```

2. **Start development server:**

   ```bash
   npm run dev
   ```

3. **Open your browser:**
   Navigate to `http://localhost:5173`

## 📦 Integration

### Basic Usage

```javascript
import MessagingModule from "./lib/MessagingModule.svelte";

let config = {
  serverUrl: "http://your-server.com",
  username: "user123",
  theme: "modern",
};

function handleClose() {
  // Handle module close
}
```

```svelte
<MessagingModule {config} onClose={handleClose} />
```

### Configuration Options

| Option      | Type   | Default                 | Description        |
| ----------- | ------ | ----------------------- | ------------------ |
| `serverUrl` | string | `http://localhost:3000` | Backend server URL |
| `username`  | string | Required                | User display name  |
| `theme`     | string | `modern`                | UI theme           |

## 🏗️ Architecture

```
├── server/              # Node.js backend
│   └── index.js        # Socket.IO server
├── client/             # Svelte 5 frontend
│   ├── src/
│   │   ├── lib/        # Reusable components
│   │   │   ├── MessagingModule.svelte  # Main module
│   │   │   ├── RoomList.svelte         # Room browser
│   │   │   ├── CreateRoom.svelte       # Room creation
│   │   │   └── ChatRoom.svelte         # Chat interface
│   │   ├── App.svelte  # Demo application
│   │   └── main.js     # Entry point
│   └── package.json
└── package.json        # Main project config
```

## 🔧 API Reference

### Server Endpoints

- `GET /api/rooms` - List all rooms
- `POST /api/rooms` - Create new room
- `GET /api/health` - Server health check
- `GET /api/sms-reseller/clients` - List SMS reseller clients (business + KYC approved)
- `POST /api/sms-reseller/clients` - Create an SMS reseller client/provider profile
- `POST /api/sms-reseller/quotes` - Generate and store reseller pricing quote (e.g. KES 0.30/SMS)

### Socket Events

#### Client → Server

- `join-room` - Join a chat room
- `send-message` - Send a message
- `start-negotiation` - Start group negotiation
- `vote` - Cast vote on negotiation

#### Server → Client

- `message-history` - Historical messages
- `new-message` - New message received
- `user-joined/left` - User presence updates
- `negotiation-started` - Negotiation initiated
- `vote-cast` - Vote registered
- `negotiation-completed` - Negotiation finished

## 💡 Use Cases

- **Project Management** - Team decision making
- **Community Forums** - Group discussions
- **Customer Support** - Temporary help channels
- **Event Planning** - Collaborative organization
- **E-commerce** - Buyer-seller negotiations

## 🎯 Development Scripts

```bash
# Install all dependencies (server + client)
npm run install-all

# Development mode (both server and client)
npm run dev

# Server only (development)
npm run server:dev

# Client only (development)
npm run client:dev

# Build for production
npm run build

# Start production server
npm start
```

## 🌐 Production Deployment

1. **Build the client:**

   ```bash
   npm run build
   ```

2. **Set environment variables:**

   ```bash
   export PORT=3000
   export NODE_ENV=production
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

## 🔒 Security Considerations

- Input validation on all user messages
- Rate limiting for message sending
- Room size limitations
- No persistent data storage (temporary conversations)

## 🎨 Customization

### Styling

The components use CSS custom properties that can be overridden:

```css
.messaging-container {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --background-color: white;
  --text-color: #333;
}
```

### Component Extension

Extend functionality by modifying the Svelte components in `client/src/lib/`.

## 🎯 Strategy & Roadmap

See **[Competitive Strategy](docs/COMPETITIVE_STRATEGY.md)** for positioning and our edge as an open source, embeddable, self-hosted messaging platform.

For production launch prep as an SMS-selling business, use **[SMS Seller Readiness](docs/SMS_SELLER_READINESS.md)**.

For hosting and onboarding your first customer, see **[Hosting & First Customer](docs/HOSTING_AND_FIRST_CUSTOMER.md)**.

For sales and onboarding assets, use:
- **[Cheap SMS Reseller (Kenya)](docs/SMS_CHEAP_RESELLER_KENYA.md)** — Traccar phone pool, 30-min launch, tier pricing
- **[Client Proposal (Imara Logic)](docs/SMS_CLIENT_PROPOSAL_IMARALOGIC.md)**
- **[SMS API Integration Guide (share with clients)](docs/SMS_CLIENT_API_INTEGRATION.md)**
- **[SMS Reseller API Spec](docs/SMS_RESELLER_API_SPEC.md)**
- **[SMS Profit Calculator (Kenya)](docs/SMS_PROFIT_CALCULATOR_KENYA.md)**
- **[SMS Outreach Template](docs/SMS_OUTREACH_TEMPLATE.md)**

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - feel free to use in your projects!

## 🆘 Support

- Check the browser console for error messages
- Ensure server is running on the correct port
- Verify Socket.IO connection in network tab
- Test with multiple browser tabs for full functionality

---

Built with ❤️ using Node.js and Svelte 5
