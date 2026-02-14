# Nego SDK – Customization

## Position

Place the widget on the left or right:

```html
data-nego-position="bottom-left"
```

Or programmatically:

```javascript
Nego.init({ position: 'bottom-left', token: 'xxx', url: 'https://...' });
```

## Colors

### Primary Color (button, accents)

```html
data-nego-color="#2563eb"
```

Or:

```javascript
Nego.init({ primaryColor: '#2563eb', ... });
```

### Header Color

```javascript
Nego.init({ headerColor: '#1e293b', ... });
```

## Text

### Greeting (empty state)

```html
data-nego-greeting="Hi! How can we help you today?"
```

### Panel Title

```html
data-nego-title="Support"
```

### Input Placeholder

```javascript
Nego.init({ placeholder: 'Send a message...', ... });
```

## Size

```javascript
Nego.init({
  width: 400,
  height: 560,
  maxHeight: '80vh',
  ...
});
```

## Offset

Adjust distance from the corner:

```javascript
Nego.init({
  offset: { x: 24, y: 24 },
  ...
});
```

## Z-Index

Ensure the widget appears above other elements:

```javascript
Nego.init({ zIndex: 999999, ... });
```

## Event Hooks

Use callbacks for analytics or custom behavior:

```javascript
Nego.init({
  token: 'xxx',
  url: 'https://...',
  onOpen: function() {
    // Track chat opened
    gtag('event', 'chat_opened');
  },
  onMessage: function(msg) {
    // Log incoming messages
    console.log('New message:', msg.username, msg.message);
  },
  onConnect: function() {
    // Chat ready
  },
  onError: function(err) {
    // Handle errors
    console.error('Nego error:', err.message);
  }
});
```

## Advanced Styling

The SDK injects scoped styles. For deeper customization, you can override via CSS after the widget loads:

```css
#nego-widget-btn {
  background: #your-color !important;
}

#nego-widget-header {
  background: #your-header-color !important;
}

#nego-widget-panel {
  border-radius: 20px !important;
}
```

Ensure your CSS loads after the Nego script or uses sufficient specificity.
