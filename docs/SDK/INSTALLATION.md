# Nego SDK – Installation

## Option 1: Script Tag (Recommended)

Add the script to your HTML before the closing `</body>` tag:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Site</title>
</head>
<body>
  <h1>Welcome</h1>

  <!-- Nego chat widget -->
  <script
    src="https://yournego.com/sdk/nego.js"
    data-nego-token="YOUR_WIDGET_TOKEN"
    data-nego-url="https://yournego.com"
  ></script>
</body>
</html>
```

Replace:
- `https://yournego.com` – Your Nego server URL
- `YOUR_WIDGET_TOKEN` – Token from Nego (Invite → Embed widget → Create embed code)

## Option 2: Async Load

Load the SDK asynchronously for better page performance:

```html
<script>
  (function() {
    var s = document.createElement('script');
    s.src = 'https://yournego.com/sdk/nego.js';
    s.setAttribute('data-nego-token', 'YOUR_WIDGET_TOKEN');
    s.setAttribute('data-nego-url', 'https://yournego.com');
    s.async = true;
    document.head.appendChild(s);
  })();
</script>
```

## Option 3: Programmatic Init

Load the script, then initialize with JavaScript:

```html
<script src="https://yournego.com/sdk/nego.js"></script>
<script>
  Nego.init({
    token: 'YOUR_WIDGET_TOKEN',
    url: 'https://yournego.com',
    position: 'bottom-right',
    greeting: 'Hi! How can we help?'
  }).then(function(widget) {
    console.log('Nego widget loaded');
  }).catch(function(err) {
    console.error('Nego failed:', err);
  });
</script>
```

## Getting the Widget Token

1. Log in to Nego
2. Open or create a room
3. Click **Invite**
4. Scroll to **Embed widget**
5. Click **Create embed code** (if you haven't already)
6. Copy the script tag or token

## Self-Hosted vs Nego Cloud

- **Self-hosted**: Use your server URL, e.g. `https://chat.mycompany.com`
- **Nego Cloud**: Use your Nego Cloud URL (provided when you sign up)

The SDK works the same in both cases.
