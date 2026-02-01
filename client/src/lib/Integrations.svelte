<script>
  import { playClick, playSuccess } from "./theme.js";

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
      const res = await fetch(`${base()}/api/channels/${channel}`);
      if (!res.ok) return;
      const data = await res.json();
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
        body: JSON.stringify(body),
      });
      if (res.ok) {
        message = "Config saved.";
        playSuccess();
      } else {
        const d = await res.json().catch(() => ({}));
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
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
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
    if (channel) await loadChannelConfig(channel);
  }
</script>

<div class="integrations-view">
  <header class="integrations-header">
    <button type="button" class="btn-back" onclick={() => { playClick(); onBack(); }}>Back</button>
    <h2 class="integrations-title">Integrations</h2>
  </header>

  <div class="integrations-content">
    <p class="integrations-intro">
      Nego engine: Email (SMTP) sends when configured. SMS and WhatsApp work when you set your gateway/API URL; otherwise test messages are logged only. Identity and Payments config is saved and used in-app for verification and payment requests.
    </p>

    {#if message}
      <div class="banner success" role="status">{message}</div>
    {/if}
    {#if error}
      <div class="banner err" role="alert">{error}</div>
    {/if}

    <div class="channel-tabs">
      <button type="button" class="tab" class:active={activeChannel === "email"} onclick={() => setActive("email")}>Email (SMTP)</button>
      <button type="button" class="tab" class:active={activeChannel === "sms"} onclick={() => setActive("sms")}>SMS</button>
      <button type="button" class="tab" class:active={activeChannel === "whatsapp"} onclick={() => setActive("whatsapp")}>WhatsApp</button>
      <button type="button" class="tab" class:active={activeChannel === "identity"} onclick={() => setActive("identity")}>Identity</button>
      <button type="button" class="tab" class:active={activeChannel === "payments"} onclick={() => setActive("payments")}>Payments</button>
    </div>

    {#if activeChannel === "email"}
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

  .integrations-intro {
    margin: 0 0 1.5rem;
    font-size: 0.9375rem;
    color: var(--gray-600);
    line-height: 1.5;
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
