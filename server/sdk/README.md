# Nego SDK

Embeddable chat widget for customer websites.

## Quick Start

```html
<script
  src="https://yourserver.com/sdk/nego.js"
  data-nego-token="YOUR_TOKEN"
  data-nego-url="https://yourserver.com"
></script>
```

## Full Documentation

See the [SDK Documentation](../../docs/SDK/README.md):

- [Installation](../../docs/SDK/INSTALLATION.md)
- [Configuration](../../docs/SDK/CONFIGURATION.md)
- [API Reference](../../docs/SDK/API-REFERENCE.md)
- [Integration Guides](../../docs/SDK/INTEGRATION-GUIDES.md) – React, Vue, WordPress, Next.js, Svelte
- [Customization](../../docs/SDK/CUSTOMIZATION.md)

## Programmatic Usage

```javascript
Nego.init({
  token: 'YOUR_TOKEN',
  url: 'https://yourserver.com',
  position: 'bottom-right',
  primaryColor: '#059669',
  onOpen: function() { console.log('Chat opened'); },
  onMessage: function(msg) { console.log('New message', msg); }
}).then(function(widget) {
  widget.open();
  widget.sendMessage('Hi!');
});
```

## API Methods

| Method | Description |
|--------|-------------|
| `widget.open()` | Open the chat panel |
| `widget.close()` | Close the chat panel |
| `widget.toggle()` | Toggle open/close |
| `widget.sendMessage(text)` | Send a message |
| `widget.getState()` | Get current state |
| `widget.destroy()` | Remove widget from DOM |

## Training Your Chatbot

To have the widget respond as an AI chatbot (instead of human chat), assign the room to an AI agent and train it via **Workflows**—the same way we train the global help chatbot. See [Training Your Chatbot](../../docs/SDK/TRAINING-CHATBOT.md).

## Version

SDK v1.0.0
