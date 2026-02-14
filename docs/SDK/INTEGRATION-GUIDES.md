# Nego SDK – Integration Guides

## Vanilla HTML / JavaScript

See [Installation](INSTALLATION.md) for the basic script tag setup.

## React

### Option A: Script in index.html

Add the script to `public/index.html`:

```html
<script
  src="https://yournego.com/sdk/nego.js"
  data-nego-token={process.env.REACT_APP_NEGO_TOKEN}
  data-nego-url={process.env.REACT_APP_NEGO_URL}
></script>
```

### Option B: useEffect Hook

```jsx
import { useEffect, useRef } from 'react';

function App() {
  const widgetRef = useRef(null);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://yournego.com/sdk/nego.js';
    script.async = true;
    script.setAttribute('data-nego-token', process.env.REACT_APP_NEGO_TOKEN);
    script.setAttribute('data-nego-url', process.env.REACT_APP_NEGO_URL);
    document.body.appendChild(script);

    script.onload = () => {
      widgetRef.current = window.NegoWidget;
    };

    return () => {
      if (widgetRef.current && widgetRef.current.destroy) {
        widgetRef.current.destroy();
      }
      script.remove();
    };
  }, []);

  return <div>Your app</div>;
}
```

### Option C: Programmatic Init

```jsx
useEffect(() => {
  if (!window.Nego) return;
  
  window.Nego.init({
    token: process.env.REACT_APP_NEGO_TOKEN,
    url: process.env.REACT_APP_NEGO_URL,
    onMessage: (msg) => console.log('New message', msg)
  }).then(widget => {
    widgetRef.current = widget;
  });

  return () => {
    if (widgetRef.current) widgetRef.current.destroy();
  };
}, []);
```

---

## Vue 3

```vue
<template>
  <div id="app">Your app</div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue';

let widget = null;

onMounted(() => {
  const script = document.createElement('script');
  script.src = 'https://yournego.com/sdk/nego.js';
  script.setAttribute('data-nego-token', import.meta.env.VITE_NEGO_TOKEN);
  script.setAttribute('data-nego-url', import.meta.env.VITE_NEGO_URL);
  document.body.appendChild(script);

  script.onload = () => {
    widget = window.NegoWidget;
  };
});

onUnmounted(() => {
  if (widget && widget.destroy) widget.destroy();
});
</script>
```

---

## WordPress

### Method 1: Theme Footer

Add to `footer.php` before `</body>`:

```php
<script
  src="https://yournego.com/sdk/nego.js"
  data-nego-token="<?php echo esc_attr(get_option('nego_widget_token')); ?>"
  data-nego-url="https://yournego.com"
></script>
```

### Method 2: Plugin

Create a simple plugin that enqueues the script:

```php
add_action('wp_footer', function() {
  $token = get_option('nego_widget_token');
  if (!$token) return;
  ?>
  <script
    src="https://yournego.com/sdk/nego.js"
    data-nego-token="<?php echo esc_attr($token); ?>"
    data-nego-url="https://yournego.com"
  ></script>
  <?php
});
```

---

## Next.js

Add to `_document.js` (Pages Router) or `layout.js` (App Router):

```jsx
// app/layout.js or pages/_document.js
<Script
  src="https://yournego.com/sdk/nego.js"
  strategy="lazyOnload"
  data-nego-token={process.env.NEXT_PUBLIC_NEGO_TOKEN}
  data-nego-url={process.env.NEXT_PUBLIC_NEGO_URL}
/>
```

Or programmatically in a client component:

```jsx
'use client';

import { useEffect } from 'react';

export default function NegoWidget() {
  useEffect(() => {
    const s = document.createElement('script');
    s.src = 'https://yournego.com/sdk/nego.js';
    s.setAttribute('data-nego-token', process.env.NEXT_PUBLIC_NEGO_TOKEN);
    s.setAttribute('data-nego-url', process.env.NEXT_PUBLIC_NEGO_URL);
    document.body.appendChild(s);
    return () => s.remove();
  }, []);
  return null;
}
```

---

## Svelte / SvelteKit

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';

  let widget = null;

  onMount(() => {
    const s = document.createElement('script');
    s.src = 'https://yournego.com/sdk/nego.js';
    s.setAttribute('data-nego-token', import.meta.env.VITE_NEGO_TOKEN);
    s.setAttribute('data-nego-url', import.meta.env.VITE_NEGO_URL);
    document.body.appendChild(s);
    s.onload = () => (widget = window.NegoWidget);
  });

  onDestroy(() => {
    if (widget?.destroy) widget.destroy();
  });
</script>
```
