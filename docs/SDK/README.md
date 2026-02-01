# Nego SDK Documentation

The Nego SDK lets you embed a live chat widget on your website. Visitors can chat with your team directly from your site—no account required.

## Features

- **Embeddable chat widget** – Add a chat bubble to any webpage
- **Real-time messaging** – Powered by WebSocket for instant delivery
- **Anonymous visitors** – Visitors chat as "Visitor-xxx" without signing up
- **Customizable** – Position, colors, greeting, and more
- **Programmatic API** – Control the widget via JavaScript
- **Trainable chatbot** – Assign the room to an AI agent and train it via Workflows (same as the global help chatbot)

## Quick Start

### 1. Get your embed code

In Nego, open a room → click **Invite** → scroll to **Embed widget** → **Create embed code** → Copy.

### 2. Add to your website

Paste the script tag before `</body>`:

```html
<script
  src="https://yournego.com/sdk/nego.js"
  data-nego-token="nego_xxxxxxxxxxxx"
  data-nego-url="https://yournego.com"
></script>
```

### 3. Train your chatbot (optional)

To have the widget respond as an AI chatbot (instead of human chat), train it the same way as the global help chatbot:

1. In Nego, open the room used by the widget
2. Go to **Workflows** and configure an agent (Sales, Marketing, or Receptionist) with your product info, KPIs, and instructions
3. **Assign** the room to that agent (Assign → Sales Agent / Marketing Agent / Receptionist)
4. Visitors will now chat with your trained AI agent, which auto-replies based on your workflow configuration

Without this, visitors chat with humans in the room. With it, they get instant AI responses.

## Documentation

| Document | Description |
|----------|-------------|
| [Installation](INSTALLATION.md) | Installation options, CDN, npm |
| [Configuration](CONFIGURATION.md) | All configuration options |
| [API Reference](API-REFERENCE.md) | Methods, events, programmatic usage |
| [Integration Guides](INTEGRATION-GUIDES.md) | React, Vue, WordPress, etc. |
| [Customization](CUSTOMIZATION.md) | Styling, branding, theming |
| [Training Your Chatbot](TRAINING-CHATBOT.md) | How to train the widget as an AI chatbot (Workflows) |

## Browser Support

- Chrome, Firefox, Safari, Edge (latest)
- IE11 not supported

## Version

SDK version: **1.0.0**
