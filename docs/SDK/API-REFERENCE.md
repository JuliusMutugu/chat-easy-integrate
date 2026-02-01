# Nego SDK – API Reference

## Nego.init(options)

Initialize the widget programmatically. Returns a Promise that resolves with the widget instance.

```javascript
Nego.init({
  token: 'nego_xxx',
  url: 'https://yournego.com'
}).then(function(widget) {
  // widget is the Nego instance
  widget.open();
}).catch(function(err) {
  console.error(err);
});
```

**Parameters:**
- `options` (object) – Configuration object. Requires `token` and `url`.

**Returns:** Promise\<Nego\>

---

## Nego Instance Methods

### widget.open()

Opens the chat panel.

```javascript
widget.open();
```

---

### widget.close()

Closes the chat panel.

```javascript
widget.close();
```

---

### widget.toggle()

Toggles the chat panel open/closed.

```javascript
widget.toggle();
```

---

### widget.sendMessage(text)

Sends a message. If no argument, sends the current input value.

```javascript
widget.sendMessage('Hello!');
// or
widget.sendMessage(); // sends whatever is in the input
```

**Parameters:**
- `text` (string, optional) – Message to send.

**Returns:** boolean – `true` if sent, `false` if not (e.g. empty or not connected).

---

### widget.getState()

Returns the current widget state.

```javascript
var state = widget.getState();
// {
//   open: boolean,
//   connected: boolean,
//   messages: array,
//   visitorId: string,
//   roomId: string,
//   roomName: string
// }
```

**Returns:** object

---

### widget.destroy()

Removes the widget from the DOM and disconnects.

```javascript
widget.destroy();
```

---

## Global Reference

After init from script tag, the widget instance is available as `window.NegoWidget`:

```javascript
NegoWidget.open();
NegoWidget.sendMessage('Hi');
```

---

## Event Callbacks

Pass these in the options when calling `Nego.init()`:

### onOpen()

Called when the user opens the chat panel.

```javascript
Nego.init({
  token: 'xxx',
  url: 'https://yournego.com',
  onOpen: function() {
    console.log('Chat opened');
  }
});
```

### onClose()

Called when the user closes the chat panel.

### onMessage(msg)

Called when a new message is received.

```javascript
onMessage: function(msg) {
  // msg: { id, username, message, timestamp }
  console.log('New message from', msg.username, msg.message);
}
```

### onConnect()

Called when the widget connects to the server.

### onError(err)

Called when an error occurs (connection failed, invalid token, etc.).

```javascript
onError: function(err) {
  console.error('Nego error:', err.message);
}
```

---

## Static Properties

### Nego.version

Returns the SDK version string (e.g. `"1.0.0"`).
