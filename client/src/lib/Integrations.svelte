<script>
  import { playClick, playSuccess, safeParseJson } from "./theme.js";

  export let config = { serverUrl: "http://localhost:3000" };
  export let onBack = () => {};

  let activeChannel = null;
  let emailConfig = { host: "", port: 587, secure: false, user: "", pass: "", from: "" };
  let smsConfig = { gatewayUrl: "", apiKey: "" };
  let whatsappConfig = { apiUrl: "", token: "", phoneId: "" };
  let identityConfig = { iprsUrl: "", iprsKey: "", onfidoApiToken: "", stripeIdentityKey: "" };
  let paymentsConfig = { mpesaConsumerKey: "", mpesaConsumerSecret: "", pesapalUrl: "", stripeSecretKey: "", paypalClientId: "" };
  let testTo = "";
  let testBody = "Test message from Nego.";
  let testSubject = "Test email";
  let saving = false;
  let sending = false;
  let message = "";
  let error = "";

  const base = () => config.serverUrl || "";

  async function loadChannelConfig(channel) {
    try {
      const res = await fetch(`${base()}/api/channels/${channel}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await safeParseJson(res);
      if (channel === "email") emailConfig = { ...emailConfig, ...(data.config || {}) };
      if (channel === "sms") smsConfig = { ...smsConfig, ...(data.config || {}) };
      if (channel === "whatsapp") whatsappConfig = { ...whatsappConfig, ...(data.config || {}) };
      if (channel === "identity") identityConfig = { ...identityConfig, ...(data.config || {}) };
      if (channel === "payments") paymentsConfig = { ...paymentsConfig, ...(data.config || {}) };
    } catch (e) {
      console.error(e);
    }
  }

  async function saveConfig(channel) {
    saving = true;
    error = "";
    message = "";
    try {
      const body = channel === "email" ? emailConfig : channel === "sms" ? smsConfig : channel === "whatsapp" ? whatsappConfig : channel === "identity" ? identityConfig : paymentsConfig;
      const res = await fetch(`${base()}/api/channels/${channel}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (res.ok) {
        message = "Config saved.";
        playSuccess();
      } else {
        const d = await safeParseJson(res) || {};
        error = d.error || "Failed to save";
      }
    } catch (e) {
      error = e.message || "Failed to save";
    } finally {
      saving = false;
    }
  }

  async function sendTest(channel) {
    sending = true;
    error = "";
    message = "";
    try {
      let url, body;
      if (channel === "email") {
        url = `${base()}/api/channels/email/send`;
        body = { to: testTo, subject: testSubject, text: testBody };
      } else if (channel === "sms") {
        url = `${base()}/api/channels/sms/send`;
        body = { to: testTo, body: testBody };
      } else {
        url = `${base()}/api/channels/whatsapp/send`;
        body = { to: testTo, body: testBody };
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await safeParseJson(res) || {};
      if (res.ok) {
        message = "Test sent.";
        playSuccess();
      } else {
        error = data.error || "Send failed";
      }
    } catch (e) {
      error = e.message || "Send failed";
    } finally {
      sending = false;
    }
  }

  async function setActive(channel) {
    playClick();
    activeChannel = channel;
    message = "";
    error = "";
    if (channel === "chat-widget") {
      await loadWidgetRooms();
    } else if (channel) {
      await loadChannelConfig(channel);
    }
  }

  const CHANNEL_CATALOG = [
    { id: "chat-widget", name: "Chat Widget", category: "business", description: "Embed a chat bubble on your website. Visitors chat without signing up. Train it as an AI chatbot.", popular: true },
    { id: "email", name: "Email (SMTP)", category: "email", description: "Use your own SMTP server. Gmail, SendGrid, or self-hosted. No lock-in.", popular: true },
    { id: "sms", name: "SMS", category: "sms", description: "Your gateway. We POST to your URL. Set Gateway URL to send; leave empty for dev.", popular: false },
    { id: "whatsapp", name: "WhatsApp Business", category: "business", description: "Your adapter. Plug Meta WhatsApp Business API or compatible provider.", popular: true },
    { id: "identity", name: "Identity (KYC)", category: "more", description: "Local: IPRS (Kenya). Global: Onfido, Stripe Identity. Used in-app for verification.", popular: false },
    { id: "payments", name: "Payments", category: "more", description: "M-Pesa, Pesapal, Stripe, PayPal. Used in-app for payment requests and invoices.", popular: false },
  ];

  let catalogCategory = "all";
  let catalogSearch = "";

  // Chat Widget
  let widgetRooms = [];
  let widgetSelectedRoomId = "";
  let widgetEmbedCode = "";
  let widgetCreating = false;
  let widgetCopySuccess = false;

  async function loadWidgetRooms() {
    try {
      const res = await fetch(`${base()}/api/rooms?username=${encodeURIComponent(config.username || "")}`, { credentials: "include" });
      if (res.ok) {
        const data = await safeParseJson(res);
        widgetRooms = Array.isArray(data) ? data : [];
        if (widgetRooms.length > 0 && !widgetSelectedRoomId) {
          widgetSelectedRoomId = widgetRooms[0].id;
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function createWidget() {
    if (!widgetSelectedRoomId || widgetCreating) return;
    widgetCreating = true;
    error = "";
    message = "";
    try {
      const res = await fetch(`${base()}/api/widget/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ roomId: widgetSelectedRoomId, allowedOrigins: "*" }),
      });
      const data = await safeParseJson(res) || {};
      if (!res.ok) throw new Error(data.error || "Failed to create widget");
      widgetEmbedCode = data.embedCode || "";
      message = "Widget created! Copy the code below and add it to your website.";
      playSuccess();
    } catch (e) {
      error = e.message || "Failed to create widget";
    } finally {
      widgetCreating = false;
    }
  }

  async function copyWidgetCode() {
    if (!widgetEmbedCode) return;
    try {
      await navigator.clipboard.writeText(widgetEmbedCode);
      widgetCopySuccess = true;
      playSuccess();
      setTimeout(() => (widgetCopySuccess = false), 2000);
    } catch (_) {
      error = "Could not copy. Select and copy manually.";
    }
  }

  $: catalogFiltered = CHANNEL_CATALOG.filter((ch) => {
    const matchCat = catalogCategory === "all" || ch.category === catalogCategory;
    const q = catalogSearch.trim().toLowerCase();
    const matchSearch = !q || (ch.name && ch.name.toLowerCase().includes(q)) || (ch.description && ch.description.toLowerCase().includes(q));
    return matchCat && matchSearch;
  });
</script>

<div class="integrations-view">
  <header class="integrations-header">
    <button type="button" class="btn-back" onclick={() => { playClick(); onBack(); }}>Back</button>
    <h2 class="integrations-title">Channels</h2>
  </header>

  <div class="integrations-content">
    <section class="channel-catalog" aria-labelledby="catalog-heading">
      <h2 id="catalog-heading" class="catalog-title">Channel Catalog</h2>
      <p class="catalog-desc">Manage your messaging channels and discover new ones to help you acquire more customers.</p>
      <div class="catalog-toolbar">
        <div class="catalog-tabs">
          <button type="button" class="catalog-tab" class:active={catalogCategory === "all"} onclick={() => { playClick(); catalogCategory = "all"; }}>All</button>
          <button type="button" class="catalog-tab" class:active={catalogCategory === "business"} onclick={() => { playClick(); catalogCategory = "business"; }}>Business Messaging</button>
          <button type="button" class="catalog-tab" class:active={catalogCategory === "sms"} onclick={() => { playClick(); catalogCategory = "sms"; }}>SMS</button>
          <button type="button" class="catalog-tab" class:active={catalogCategory === "email"} onclick={() => { playClick(); catalogCategory = "email"; }}>Email</button>
          <button type="button" class="catalog-tab" class:active={catalogCategory === "more"} onclick={() => { playClick(); catalogCategory = "more"; }}>More</button>
        </div>
        <div class="catalog-search-row">
          <input type="search" class="catalog-search" placeholder="Search Channel Catalog" bind:value={catalogSearch} aria-label="Search Channel Catalog" />
        </div>
      </div>
      <div class="catalog-grid">
        {#each catalogFiltered as ch}
          <article class="catalog-card">
            <div class="catalog-card-icon" data-channel={ch.id}>
              {#if ch.id === "email"}
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              {:else if ch.id === "chat-widget"}
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              {:else if ch.id === "sms"}
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              {:else if ch.id === "whatsapp"}
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              {/if}
            </div>
            {#if ch.popular}<span class="catalog-badge">Popular</span>{/if}
            <h3 class="catalog-card-name">{ch.name}</h3>
            <p class="catalog-card-desc">{ch.description}</p>
            <button type="button" class="catalog-connect" onclick={() => setActive(ch.id)}>Connect</button>
          </article>
        {/each}
      </div>
    </section>

    {#if message}
      <div class="banner success" role="status">{message}</div>
    {/if}
    {#if error}
      <div class="banner err" role="alert">{error}</div>
    {/if}

    {#if activeChannel}
      <h3 class="config-heading">Configure: {CHANNEL_CATALOG.find(c => c.id === activeChannel)?.name ?? activeChannel}</h3>
    {/if}
    <div class="channel-tabs">
      <button type="button" class="tab" class:active={activeChannel === "chat-widget"} onclick={() => setActive("chat-widget")}>Chat Widget</button>
      <button type="button" class="tab" class:active={activeChannel === "email"} onclick={() => setActive("email")}>Email (SMTP)</button>
      <button type="button" class="tab" class:active={activeChannel === "sms"} onclick={() => setActive("sms")}>SMS</button>
      <button type="button" class="tab" class:active={activeChannel === "whatsapp"} onclick={() => setActive("whatsapp")}>WhatsApp</button>
      <button type="button" class="tab" class:active={activeChannel === "identity"} onclick={() => setActive("identity")}>Identity</button>
      <button type="button" class="tab" class:active={activeChannel === "payments"} onclick={() => setActive("payments")}>Payments</button>
    </div>

    {#if activeChannel === "chat-widget"}
      <section class="channel-panel channel-panel-widget">
        <h3>Chat Widget</h3>
        <p class="channel-desc">Add a chat bubble to your website. Visitors can chat without signing up. No coding needed—copy, paste, done.</p>

        <div class="widget-guide-section">
          <h4 class="widget-guide-title">Step 1: Choose a room</h4>
          <p class="widget-guide-text">Select the room where widget visitors will chat. You can reply as a human, or train an AI to reply automatically.</p>
          <label class="widget-select-label" for="widget-room-select">Room</label>
          <select id="widget-room-select" class="widget-select" bind:value={widgetSelectedRoomId} disabled={!widgetRooms.length}>
            <option value="">{widgetRooms.length ? "Select a room..." : "No rooms yet. Create a room first."}</option>
            {#each widgetRooms as room (room.id)}
              <option value={room.id}>{room.name}</option>
            {/each}
          </select>
        </div>

        <div class="widget-guide-section">
          <h4 class="widget-guide-title">Step 2: Generate embed code</h4>
          <p class="widget-guide-text">Click the button below to create your unique embed code.</p>
          <button type="button" class="btn-save" disabled={!widgetSelectedRoomId || widgetCreating} onclick={createWidget}>
            {widgetCreating ? "Creating…" : "Generate embed code"}
          </button>
        </div>

        {#if widgetEmbedCode}
          <div class="widget-guide-section">
            <h4 class="widget-guide-title">Step 3: Add to your website</h4>
            <p class="widget-guide-text">Copy the code below. Paste it into your website's HTML, just before the <code>&lt;/body&gt;</code> tag. That's it.</p>
            <div class="widget-embed-wrap">
              <textarea class="widget-embed-code" readonly rows="4">{widgetEmbedCode}</textarea>
              <button type="button" class="btn-copy-widget" class:copied={widgetCopySuccess} onclick={copyWidgetCode}>
                {widgetCopySuccess ? "Copied!" : "Copy code"}
              </button>
            </div>
            <p class="widget-hint">Works with any website: WordPress, Wix, Squarespace, or custom HTML. If you use a page builder, add a "Custom HTML" or "Embed" block and paste the code there.</p>
          </div>
        {/if}

        <div class="widget-guide-section widget-train-section">
          <h4 class="widget-guide-title">Train your chatbot (optional)</h4>
          <p class="widget-guide-text">Want the widget to reply automatically with AI? Train it using the Chat Widget workflow:</p>
          <ol class="widget-train-steps">
            <li>Go to <strong>Workflows</strong> and choose <strong>Chat Widget</strong> (dedicated workflow for the embeddable widget)</li>
            <li>Fill in <strong>Product</strong>, <strong>KPIs</strong>, and <strong>Instructions</strong>—what your chatbot should know and how it should reply</li>
            <li>Save the workflow</li>
            <li>Open your room, click <strong>Assign</strong>, and assign it to <strong>Chat Widget</strong></li>
            <li>Visitors will now get instant AI replies instead of waiting for a human</li>
          </ol>
          <p class="widget-hint">Without training, visitors chat with humans in the room. With training, they get instant AI responses 24/7.</p>
        </div>
      </section>
    {:else if activeChannel === "email"}
      <section class="channel-panel">
        <h3>Email (SMTP)</h3>
        <p class="channel-desc">Use your own SMTP server (Gmail, SendGrid, or self-hosted). No third-party lock-in.</p>
        <div class="form">
          <label>Host <input type="text" bind:value={emailConfig.host} placeholder="smtp.gmail.com" /></label>
          <label>Port <input type="number" bind:value={emailConfig.port} placeholder="587" /></label>
          <label class="checkbox"><input type="checkbox" bind:checked={emailConfig.secure} /> Secure (TLS)</label>
          <label>User <input type="text" bind:value={emailConfig.user} placeholder="your@email.com" /></label>
          <label>Password <input type="password" bind:value={emailConfig.pass} placeholder="app password" /></label>
          <label>From (optional) <input type="text" bind:value={emailConfig.from} placeholder="Sender name &lt;email&gt;" /></label>
          <div class="actions">
            <button type="button" class="btn-save" disabled={saving} onclick={() => saveConfig("email")}>{saving ? "Saving…" : "Save config"}</button>
          </div>
        </div>
        <div class="test-block">
          <h4>Send test email</h4>
          <label>To <input type="text" bind:value={testTo} placeholder="recipient@example.com" /></label>
          <label>Subject <input type="text" bind:value={testSubject} /></label>
          <label>Body <textarea bind:value={testBody} rows="2"></textarea></label>
          <button type="button" class="btn-send" disabled={sending || !testTo} onclick={() => sendTest("email")}>{sending ? "Sending…" : "Send test"}</button>
        </div>
      </section>
    {:else if activeChannel === "sms"}
      <section class="channel-panel">
        <h3>SMS</h3>
        <p class="channel-desc">Your own gateway. We POST <code>{'{ to, body }'}</code> to your URL. Set Gateway URL to send; leave empty for dev (logged only).</p>
        <div class="form">
          <label>Gateway URL <input type="url" bind:value={smsConfig.gatewayUrl} placeholder="https://your-sms-gateway.com/send" /></label>
          <label>API key (optional) <input type="password" bind:value={smsConfig.apiKey} placeholder="Bearer token" /></label>
          <div class="actions">
            <button type="button" class="btn-save" disabled={saving} onclick={() => saveConfig("sms")}>{saving ? "Saving…" : "Save config"}</button>
          </div>
        </div>
        <div class="test-block">
          <h4>Send test SMS</h4>
          <p class="hint">If no gateway URL is set, the message is logged only (dev mode).</p>
          <label>To (number) <input type="text" bind:value={testTo} placeholder="+1234567890" /></label>
          <label>Body <textarea bind:value={testBody} rows="2"></textarea></label>
          <button type="button" class="btn-send" disabled={sending || !testTo} onclick={() => sendTest("sms")}>{sending ? "Sending…" : "Send test"}</button>
        </div>
      </section>
    {:else if activeChannel === "whatsapp"}
      <section class="channel-panel">
        <h3>WhatsApp</h3>
        <p class="channel-desc">Your own adapter. Set API URL to send; leave empty for dev (logged only). We POST to your endpoint; you plug Meta WhatsApp Business API or compatible provider.</p>
        <div class="form">
          <label>API URL <input type="url" bind:value={whatsappConfig.apiUrl} placeholder="https://your-whatsapp-api.com/send" /></label>
          <label>Token (optional) <input type="password" bind:value={whatsappConfig.token} /></label>
          <label>Phone ID (optional) <input type="text" bind:value={whatsappConfig.phoneId} placeholder="Meta phone number ID" /></label>
          <div class="actions">
            <button type="button" class="btn-save" disabled={saving} onclick={() => saveConfig("whatsapp")}>{saving ? "Saving…" : "Save config"}</button>
          </div>
        </div>
        <div class="test-block">
          <h4>Send test WhatsApp</h4>
          <p class="hint">If no API URL is set, the message is logged only (dev mode).</p>
          <label>To (number) <input type="text" bind:value={testTo} placeholder="15551234567" /></label>
          <label>Body <textarea bind:value={testBody} rows="2"></textarea></label>
          <button type="button" class="btn-send" disabled={sending || !testTo} onclick={() => sendTest("whatsapp")}>{sending ? "Sending…" : "Send test"}</button>
        </div>
      </section>
    {:else if activeChannel === "identity"}
      <section class="channel-panel">
        <h3>Identity verification</h3>
        <p class="channel-desc">Local: IPRS (Kenya). Global: Onfido, Stripe Identity. Config is used in-app for identity verification when you enable it in a room.</p>
        <div class="form">
          <label>IPRS API URL (Kenya) <input type="url" bind:value={identityConfig.iprsUrl} placeholder="https://iprs-api.example.com" /></label>
          <label>IPRS API key <input type="password" bind:value={identityConfig.iprsKey} placeholder="API key" /></label>
          <label>Onfido API token <input type="password" bind:value={identityConfig.onfidoApiToken} placeholder="Live or sandbox token" /></label>
          <label>Stripe Identity publishable key <input type="text" bind:value={identityConfig.stripeIdentityKey} placeholder="pk_..." /></label>
          <div class="actions">
            <button type="button" class="btn-save" disabled={saving} onclick={() => saveConfig("identity")}>{saving ? "Saving…" : "Save config"}</button>
          </div>
        </div>
      </section>
    {:else if activeChannel === "payments"}
      <section class="channel-panel">
        <h3>Payments (dual-currency / dual-gateway)</h3>
        <p class="channel-desc">Local: M-Pesa (Daraja), Pesapal. Global: Stripe, PayPal. Config is used in-app for payment requests and invoices.</p>
        <div class="form">
          <label>M-Pesa (Daraja) consumer key <input type="text" bind:value={paymentsConfig.mpesaConsumerKey} placeholder="Consumer key" /></label>
          <label>M-Pesa consumer secret <input type="password" bind:value={paymentsConfig.mpesaConsumerSecret} placeholder="Consumer secret" /></label>
          <label>Pesapal base URL <input type="url" bind:value={paymentsConfig.pesapalUrl} placeholder="https://pay.pesapal.com" /></label>
          <label>Stripe secret key <input type="password" bind:value={paymentsConfig.stripeSecretKey} placeholder="sk_..." /></label>
          <label>PayPal client ID <input type="text" bind:value={paymentsConfig.paypalClientId} placeholder="Client ID" /></label>
          <div class="actions">
            <button type="button" class="btn-save" disabled={saving} onclick={() => saveConfig("payments")}>{saving ? "Saving…" : "Save config"}</button>
          </div>
        </div>
      </section>
    {:else}
      <p class="pick-channel">Select a channel above to configure and send.</p>
    {/if}
  </div>
</div>

<style>
  .integrations-view {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
  }

  .integrations-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .btn-back {
    background: var(--gray-100);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--gray-700);
    font-family: inherit;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .btn-back:hover {
    background: var(--gray-200);
    border-color: var(--gray-300);
  }

  .integrations-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--navy-900);
  }

  .integrations-content {
    flex: 1;
    overflow-y: auto;
  }

  /* Channel Catalog (respond.io style) */
  .channel-catalog {
    margin-bottom: 2rem;
  }

  .catalog-title {
    margin: 0 0 0.25rem;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--navy-900);
  }

  .catalog-desc {
    margin: 0 0 1.25rem;
    font-size: 0.9375rem;
    color: var(--gray-600);
    line-height: 1.5;
  }

  .catalog-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .catalog-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .catalog-tab {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card-bg);
    color: var(--gray-700);
    font-size: 0.875rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .catalog-tab:hover {
    background: var(--gray-50);
    border-color: var(--gray-300);
  }

  .catalog-tab.active {
    background: var(--navy-800);
    color: var(--white);
    border-color: var(--navy-800);
  }

  .catalog-search-row {
    flex-shrink: 0;
  }

  .catalog-search {
    width: 100%;
    max-width: 320px;
    padding: 0.5rem 0.75rem 0.5rem 2.25rem;
    border: 2px solid var(--border);
    border-radius: 8px;
    font-size: 0.875rem;
    font-family: inherit;
    background: var(--card-bg) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E") no-repeat 0.65rem center;
  }

  .catalog-search:focus {
    outline: none;
    border-color: var(--green-600);
  }

  .catalog-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  .catalog-card {
    position: relative;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
  }

  .catalog-card:hover {
    border-color: var(--gray-300);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  }

  .catalog-card-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    margin-bottom: 0.75rem;
    color: var(--navy-700);
    background: var(--gray-100);
  }

  .catalog-card-icon[data-channel="email"] { color: var(--navy-700); }
  .catalog-card-icon[data-channel="chat-widget"] { color: var(--green-700); }
  .catalog-card-icon[data-channel="sms"] { color: var(--green-700); }
  .catalog-card-icon[data-channel="whatsapp"] { color: #25D366; }
  .catalog-card-icon[data-channel="identity"],
  .catalog-card-icon[data-channel="payments"] { color: var(--navy-600); }

  .catalog-badge {
    position: absolute;
    top: 1rem;
    right: 1rem;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--green-700);
    background: var(--green-100);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
  }

  .catalog-card-name {
    margin: 0 0 0.35rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--navy-900);
  }

  .catalog-card-desc {
    margin: 0 0 1rem;
    font-size: 0.8125rem;
    color: var(--gray-600);
    line-height: 1.45;
    flex: 1;
  }

  .catalog-connect {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: 1px solid var(--green-600);
    background: var(--green-600);
    color: var(--white);
    font-size: 0.875rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .catalog-connect:hover {
    background: var(--green-700);
    border-color: var(--green-700);
  }

  .config-heading {
    margin: 1rem 0 0.75rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--navy-900);
  }

  .banner {
    padding: 0.75rem 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .banner.success {
    background: var(--green-100);
    color: var(--green-800);
  }

  .banner.err {
    background: var(--gray-100);
    color: var(--gray-900);
    border: 1px solid var(--gray-300);
  }

  .channel-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .tab {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card-bg);
    color: var(--gray-700);
    font-size: 0.875rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .tab:hover {
    background: var(--gray-50);
    border-color: var(--gray-300);
  }

  .tab.active {
    background: var(--navy-800);
    color: var(--white);
    border-color: var(--navy-800);
  }

  .channel-panel {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .channel-panel h3 {
    margin: 0 0 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--navy-900);
  }

  .channel-desc {
    margin: 0 0 1rem;
    font-size: 0.875rem;
    color: var(--gray-600);
    line-height: 1.45;
  }

  .channel-desc code {
    background: var(--gray-100);
    padding: 0.1rem 0.35rem;
    border-radius: 4px;
    font-size: 0.8125rem;
  }

  /* Chat Widget panel */
  .channel-panel-widget .channel-desc {
    margin-bottom: 1.5rem;
  }

  .widget-guide-section {
    margin-bottom: 1.75rem;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--border);
  }

  .widget-guide-section:last-child {
    border-bottom: none;
  }

  .widget-guide-title {
    margin: 0 0 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--navy-900);
  }

  .widget-guide-text {
    margin: 0 0 0.75rem;
    font-size: 0.9375rem;
    color: var(--gray-600);
    line-height: 1.5;
  }

  .widget-select-label {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--gray-700);
  }

  .widget-select {
    width: 100%;
    max-width: 400px;
    padding: 0.625rem 0.875rem;
    font-size: 0.9375rem;
    font-family: inherit;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card-bg);
    color: var(--text-primary);
  }

  .widget-embed-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .widget-embed-code {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.75rem;
    font-family: monospace;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--gray-50);
    resize: vertical;
    min-height: 5rem;
  }

  .btn-copy-widget {
    align-self: flex-start;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    font-family: inherit;
    background: var(--green-600);
    color: var(--white);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .btn-copy-widget:hover {
    background: var(--green-700);
  }

  .btn-copy-widget.copied {
    background: var(--gray-600);
  }

  .widget-hint {
    margin: 0.75rem 0 0;
    font-size: 0.8125rem;
    color: var(--gray-500);
    line-height: 1.5;
  }

  .widget-train-section {
    background: var(--gray-50);
    padding: 1rem 1.25rem;
    border-radius: 10px;
    border: 1px solid var(--border);
  }

  .widget-train-steps {
    margin: 0.5rem 0 0.75rem;
    padding-left: 1.5rem;
    font-size: 0.9375rem;
    color: var(--gray-700);
    line-height: 1.6;
  }

  .widget-train-steps li {
    margin-bottom: 0.5rem;
  }

  .form label {
    display: block;
    margin-bottom: 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--navy-800);
  }

  .form label.checkbox {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .form input[type="text"],
  .form input[type="url"],
  .form input[type="number"],
  .form input[type="password"] {
    display: block;
    width: 100%;
    max-width: 320px;
    padding: 0.5rem 0.75rem;
    border: 2px solid var(--border);
    border-radius: 8px;
    font-size: 0.875rem;
    font-family: inherit;
    margin-top: 0.25rem;
  }

  .form input:focus {
    outline: none;
    border-color: var(--green-600);
  }

  .actions {
    margin-top: 1rem;
  }

  .btn-save {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: none;
    background: var(--green-600);
    color: var(--white);
    font-weight: 600;
    font-size: 0.875rem;
    font-family: inherit;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .btn-save:hover:not(:disabled) {
    background: var(--green-700);
  }

  .btn-save:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .test-block {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border);
  }

  .test-block h4 {
    margin: 0 0 0.75rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--navy-900);
  }

  .test-block .hint {
    margin: 0 0 0.75rem;
    font-size: 0.8125rem;
    color: var(--gray-500);
  }

  .test-block label {
    display: block;
    margin-bottom: 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--navy-800);
  }

  .test-block input,
  .test-block textarea {
    display: block;
    width: 100%;
    max-width: 320px;
    padding: 0.5rem 0.75rem;
    border: 2px solid var(--border);
    border-radius: 8px;
    font-size: 0.875rem;
    font-family: inherit;
    margin-top: 0.25rem;
  }

  .test-block textarea {
    min-height: 60px;
    resize: vertical;
  }

  .btn-send {
    margin-top: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: none;
    background: var(--navy-800);
    color: var(--white);
    font-weight: 600;
    font-size: 0.875rem;
    font-family: inherit;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .btn-send:hover:not(:disabled) {
    background: var(--navy-900);
  }

  .btn-send:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .pick-channel {
    color: var(--gray-500);
    font-size: 0.9375rem;
  }
</style>
