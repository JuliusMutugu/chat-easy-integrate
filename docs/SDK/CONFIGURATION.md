# Nego SDK – Configuration

## Script Tag Attributes

When using the script tag, you can pass options as `data-nego-*` attributes:

| Attribute | Required | Description | Default |
|-----------|----------|-------------|---------|
| `data-nego-token` | Yes | Widget token from Nego | - |
| `data-nego-url` | Yes | Nego server URL | - |
| `data-nego-position` | No | `bottom-right` or `bottom-left` | `bottom-right` |
| `data-nego-color` | No | Primary color (hex) | `#059669` |
| `data-nego-greeting` | No | Empty state message | `No messages yet. Say hi!` |
| `data-nego-title` | No | Panel header title | `Chat` |

### Example

```html
<script
  src="https://yournego.com/sdk/nego.js"
  data-nego-token="nego_xxx"
  data-nego-url="https://yournego.com"
  data-nego-position="bottom-left"
  data-nego-color="#2563eb"
  data-nego-greeting="Hi! How can we help?"
  data-nego-title="Support"
></script>
```

## Programmatic Configuration

When using `Nego.init()`, pass an options object:

```javascript
Nego.init({
  token: 'nego_xxx',
  url: 'https://yournego.com',
  position: 'bottom-right',
  offset: { x: 20, y: 20 },
  primaryColor: '#059669',
  headerColor: '#1e293b',
  greeting: 'No messages yet. Say hi!',
  placeholder: 'Type a message...',
  title: 'Chat',
  width: 380,
  height: 500,
  maxHeight: '70vh',
  zIndex: 2147483647,
  onOpen: function() {},
  onClose: function() {},
  onMessage: function(msg) {},
  onConnect: function() {},
  onError: function(err) {}
});
```

## Full Options Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `token` | string | - | Widget token (required) |
| `url` | string | - | Nego server URL (required) |
| `position` | string | `'bottom-right'` | `'bottom-right'` or `'bottom-left'` |
| `offset` | object | `{ x: 20, y: 20 }` | Pixel offset from corner |
| `primaryColor` | string | `'#059669'` | Button and accents (hex) |
| `headerColor` | string | `'#1e293b'` | Panel header background |
| `greeting` | string | `'No messages yet. Say hi!'` | Empty state text |
| `placeholder` | string | `'Type a message...'` | Input placeholder |
| `title` | string | `'Chat'` | Panel header title |
| `width` | number | 380 | Panel width (px) |
| `height` | number | 500 | Panel height (px) |
| `maxHeight` | string | `'70vh'` | Max panel height |
| `zIndex` | number | 2147483647 | Widget z-index |
| `onOpen` | function | null | Called when panel opens |
| `onClose` | function | null | Called when panel closes |
| `onMessage` | function | null | Called when new message arrives |
| `onConnect` | function | null | Called when connected |
| `onError` | function | null | Called on error |
