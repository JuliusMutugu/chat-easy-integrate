<script>
  import { onMount } from "svelte";
  import { getEnterToSend, setEnterToSend, getCustomSnippets, addCustomSnippet, removeCustomSnippet, getThemePreference, setThemePreference, getAvatar, setAvatar, getAccent, setAccent, getChatStyle, setChatStyle, getGeminiApiKey, setGeminiApiKey } from "./theme.js";
  import { playClick, playSuccess } from "./theme.js";

  export let onBack = () => {};
  export let config = { serverUrl: "http://localhost:3000" };
  export let username = "";

  let enterToSend = true;
  let snippets = [];
  let newSnippetName = "";
  let newSnippetBody = "";
  let dataResidency = "default";
  let privacyMessage = "";
  let privacyError = "";
  let appearancePreference = "system";
  let avatarChoice = "";
  let accentChoice = "green";
  let chatStyleChoice = "solid";
  let geminiApiKey = "";
  let geminiApiKeyMessage = "";
  let geminiApiKeyError = "";

  onMount(() => {
    enterToSend = getEnterToSend();
    snippets = getCustomSnippets();
    appearancePreference = getThemePreference();
    avatarChoice = getAvatar();
    accentChoice = getAccent();
    chatStyleChoice = getChatStyle();
    geminiApiKey = getGeminiApiKey();
  });

  function saveGeminiApiKey() {
    geminiApiKeyMessage = "";
    geminiApiKeyError = "";
    setGeminiApiKey(geminiApiKey);
    geminiApiKeyMessage = "Gemini API key saved. Workflows and AI suggestions will use it when configured.";
    playSuccess();
  }

  function chooseAvatar(value) {
    avatarChoice = value;
    setAvatar(value);
    playClick();
  }

  function setAppearance(value) {
    appearancePreference = value;
    setThemePreference(value);
    playClick();
  }

  function setAccentChoice(value) {
    accentChoice = value;
    setAccent(value);
    playClick();
  }

  function setChatStyleChoice(value) {
    chatStyleChoice = value;
    setChatStyle(value);
    playClick();
  }

  function toggleEnterToSend() {
    enterToSend = !enterToSend;
    setEnterToSend(enterToSend);
    playClick();
  }

  function addSnippet() {
    if (!newSnippetName.trim() && !newSnippetBody.trim()) return;
    addCustomSnippet({ name: newSnippetName.trim() || "Snippet", body: newSnippetBody.trim() });
    snippets = getCustomSnippets();
    newSnippetName = "";
    newSnippetBody = "";
    playClick();
  }

  function removeSnippet(id) {
    removeCustomSnippet(id);
    snippets = getCustomSnippets();
    playClick();
  }

  async function requestDataExport() {
    privacyMessage = "";
    privacyError = "";
    try {
      const res = await fetch(`${config.serverUrl}/api/me/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username || "me" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        privacyMessage = data.message || "Export requested.";
        playSuccess();
      } else privacyError = data.error || "Request failed";
    } catch (e) {
      privacyError = e.message || "Request failed";
    }
  }

  async function requestDeletion() {
    if (!confirm("Request deletion of all your data (Right to be Forgotten)? This cannot be undone.")) return;
    privacyMessage = "";
    privacyError = "";
    try {
      const res = await fetch(`${config.serverUrl}/api/me/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username || "me" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        privacyMessage = data.message || "Deletion requested.";
        playSuccess();
      } else privacyError = data.error || "Request failed";
    } catch (e) {
      privacyError = e.message || "Request failed";
    }
  }
</script>

<div class="settings-view">
  <header class="settings-header">
    <button type="button" class="btn-back" onclick={() => { playClick(); onBack(); }}>Back</button>
    <h2 class="settings-title">Settings</h2>
  </header>

  <div class="settings-content">
    <section class="settings-section" aria-labelledby="appearance-heading">
      <h3 id="appearance-heading">Appearance</h3>
      <p class="setting-desc block">Choose how Nego looks for you.</p>
      <div class="appearance-options">
        <label class="appearance-option">
          <input type="radio" name="appearance" value="light" bind:group={appearancePreference} onchange={() => setAppearance("light")} />
          <span class="appearance-label">Light</span>
        </label>
        <label class="appearance-option">
          <input type="radio" name="appearance" value="dark" bind:group={appearancePreference} onchange={() => setAppearance("dark")} />
          <span class="appearance-label">Dark</span>
        </label>
        <label class="appearance-option">
          <input type="radio" name="appearance" value="system" bind:group={appearancePreference} onchange={() => setAppearance("system")} />
          <span class="appearance-label">System</span>
        </label>
      </div>
    </section>

    <section class="settings-section" aria-labelledby="accent-heading">
      <h3 id="accent-heading">Accent color</h3>
      <p class="setting-desc block">Choose a color for buttons, links, and your chat bubbles. Like choosing a theme color in messaging apps.</p>
      <div class="accent-options">
        <button type="button" class="accent-option" class:selected={accentChoice === "green"} onclick={() => setAccentChoice("green")} aria-pressed={accentChoice === "green"} title="Green">
          <span class="accent-swatch accent-green" aria-hidden="true"></span>
          <span class="accent-label">Green</span>
        </button>
        <button type="button" class="accent-option" class:selected={accentChoice === "purple"} onclick={() => setAccentChoice("purple")} aria-pressed={accentChoice === "purple"} title="Purple">
          <span class="accent-swatch accent-purple" aria-hidden="true"></span>
          <span class="accent-label">Purple</span>
        </button>
        <button type="button" class="accent-option" class:selected={accentChoice === "blue"} onclick={() => setAccentChoice("blue")} aria-pressed={accentChoice === "blue"} title="Blue">
          <span class="accent-swatch accent-blue" aria-hidden="true"></span>
          <span class="accent-label">Blue</span>
        </button>
        <button type="button" class="accent-option" class:selected={accentChoice === "teal"} onclick={() => setAccentChoice("teal")} aria-pressed={accentChoice === "teal"} title="Teal">
          <span class="accent-swatch accent-teal" aria-hidden="true"></span>
          <span class="accent-label">Teal</span>
        </button>
      </div>
    </section>

    <section class="settings-section" aria-labelledby="chat-style-heading">
      <h3 id="chat-style-heading">Chat style</h3>
      <p class="setting-desc block">How your sent messages look—solid, transparent, or minimal. Gives the conversation a different feel.</p>
      <div class="chat-style-options">
        <label class="chat-style-option">
          <input type="radio" name="chatStyle" value="solid" bind:group={chatStyleChoice} onchange={() => setChatStyleChoice("solid")} />
          <span class="chat-style-text">
            <span class="chat-style-label">Solid</span>
            <span class="chat-style-desc">Filled bubbles (default)</span>
          </span>
        </label>
        <label class="chat-style-option">
          <input type="radio" name="chatStyle" value="transparent" bind:group={chatStyleChoice} onchange={() => setChatStyleChoice("transparent")} />
          <span class="chat-style-text">
            <span class="chat-style-label">Transparent</span>
            <span class="chat-style-desc">Semi-transparent bubbles</span>
          </span>
        </label>
        <label class="chat-style-option">
          <input type="radio" name="chatStyle" value="minimal" bind:group={chatStyleChoice} onchange={() => setChatStyleChoice("minimal")} />
          <span class="chat-style-text">
            <span class="chat-style-label">Minimal</span>
            <span class="chat-style-desc">Outline only, no fill</span>
          </span>
        </label>
      </div>
    </section>

    <section class="settings-section" aria-labelledby="avatar-heading">
      <h3 id="avatar-heading">Profile avatar</h3>
      <p class="setting-desc block">Choose an avatar for your profile. Useful in organizations.</p>
      <div class="avatar-options">
        <button
          type="button"
          class="avatar-option"
          class:selected={avatarChoice === "male"}
          onclick={() => chooseAvatar("male")}
          aria-pressed={avatarChoice === "male"}
          title="Male avatar"
        >
          <span class="avatar-icon avatar-male" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/></svg>
          </span>
          <span class="avatar-label">Male</span>
        </button>
        <button
          type="button"
          class="avatar-option"
          class:selected={avatarChoice === "female"}
          onclick={() => chooseAvatar("female")}
          aria-pressed={avatarChoice === "female"}
          title="Female avatar"
        >
          <span class="avatar-icon avatar-female" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="3"/><path d="M12 14c-4 0-6 2-6 4v2h12v-2c0-2-2-4-6-4z"/></svg>
          </span>
          <span class="avatar-label">Female</span>
        </button>
      </div>
    </section>

    <section class="settings-section" aria-labelledby="ai-api-heading">
      <h3 id="ai-api-heading">AI &amp; API</h3>
      <p class="setting-desc block">Configure Gemini for workflows and negotiation KPIs. Your key is stored locally in this browser.</p>
      {#if geminiApiKeyMessage}<div class="banner success" role="status">{geminiApiKeyMessage}</div>{/if}
      {#if geminiApiKeyError}<div class="banner err" role="alert">{geminiApiKeyError}</div>{/if}
      <div class="api-key-row">
        <label for="gemini-api-key" class="setting-name">Gemini API key</label>
        <input
          id="gemini-api-key"
          type="password"
          class="api-key-input"
          placeholder="Enter your Gemini API key"
          bind:value={geminiApiKey}
          autocomplete="off"
          aria-describedby="gemini-api-hint"
        />
        <span id="gemini-api-hint" class="setting-desc block">Get a key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" class="settings-link">Google AI Studio</a>.</span>
        <button type="button" class="btn-save" onclick={saveGeminiApiKey}>Save API key</button>
      </div>
    </section>

    <section class="settings-section" aria-labelledby="messaging-heading">
      <h3 id="messaging-heading">Chat &amp; notifications</h3>
      <div class="setting-row">
        <div class="setting-label">
          <span class="setting-name">Send message on Enter</span>
          <span class="setting-desc">When on, press Enter to send. When off, Enter adds a new line; use Ctrl+Enter to send.</span>
        </div>
        <button
          type="button"
          class="toggle"
          class:on={enterToSend}
          role="switch"
          aria-checked={enterToSend}
          aria-label={enterToSend ? "Enter sends message (on)" : "Ctrl+Enter sends message (off)"}
          onclick={toggleEnterToSend}
        >
          <span class="toggle-track">
            <span class="toggle-thumb"></span>
          </span>
        </button>
      </div>
    </section>

    <section class="settings-section" aria-labelledby="snippets-heading">
      <h3 id="snippets-heading">Custom snippets</h3>
      <p class="setting-desc block">Save reusable text snippets to insert into messages from the chat input.</p>
      <div class="snippet-add">
        <input type="text" bind:value={newSnippetName} placeholder="Label (e.g. Greeting)" class="snippet-input" />
        <textarea bind:value={newSnippetBody} placeholder="Text to insert" class="snippet-textarea" rows="2"></textarea>
        <button type="button" class="btn-save" onclick={addSnippet} disabled={!newSnippetBody.trim()}>Add snippet</button>
      </div>
      <ul class="snippet-list">
        {#each snippets as s}
          <li class="snippet-item">
            <span class="snippet-name">{s.name}</span>
            <span class="snippet-body-preview">{s.body.length > 60 ? s.body.slice(0, 60) + "…" : s.body}</span>
            <button type="button" class="snippet-delete" onclick={() => removeSnippet(s.id)} aria-label="Delete snippet">Delete</button>
          </li>
        {:else}
          <li class="snippet-empty">No custom snippets yet. Add one above.</li>
        {/each}
      </ul>
    </section>

    <section class="settings-section" aria-labelledby="privacy-heading">
      <h3 id="privacy-heading">Privacy & compliance (KDPP / GDPR)</h3>
      <p class="setting-desc block">Right to be Forgotten, data export, and data residency.</p>
      {#if privacyMessage}<div class="banner success" role="status">{privacyMessage}</div>{/if}
      {#if privacyError}<div class="banner err" role="alert">{privacyError}</div>{/if}
      <div class="privacy-actions">
        <button type="button" class="btn-save" onclick={requestDataExport}>Request data export</button>
        <button type="button" class="btn-delete" onclick={requestDeletion}>Request deletion (Right to be Forgotten)</button>
      </div>
      <div class="setting-row">
        <div class="setting-label">
          <span class="setting-name">Data residency</span>
          <span class="setting-desc">Prefer storing data in a specific region (e.g. Kenya). Placeholder.</span>
        </div>
        <select bind:value={dataResidency} class="select-residency" aria-label="Data residency">
          <option value="default">Default</option>
          <option value="ke">Kenya</option>
          <option value="eu">EU (GDPR)</option>
        </select>
      </div>
    </section>
  </div>
</div>

<style>
  .settings-view {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
  }

  .settings-header {
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

  .settings-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--navy-900);
  }

  .appearance-options {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 0.5rem;
  }

  .appearance-option {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-primary);
  }

  .appearance-option input {
    width: 1rem;
    height: 1rem;
    accent-color: var(--accent);
  }

  .appearance-label {
    user-select: none;
  }

  .accent-options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .accent-option {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    padding: 0.75rem 1rem;
    border: 2px solid var(--border);
    border-radius: 12px;
    background: var(--bg-primary);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 500;
    font-family: inherit;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  .accent-option:hover {
    border-color: var(--gray-300);
    background: var(--bg-secondary);
  }

  .accent-option.selected {
    border-color: var(--accent);
    background: var(--gray-50);
  }

  .accent-swatch {
    width: 28px;
    height: 28px;
    border-radius: 50%;
  }

  .accent-green { background: #40916c; }
  .accent-purple { background: #7c3aed; }
  .accent-blue { background: #2563eb; }
  .accent-teal { background: #0d9488; }

  .accent-label {
    user-select: none;
  }

  .chat-style-options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .chat-style-option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg-primary);
    cursor: pointer;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  .chat-style-option:hover {
    border-color: var(--gray-300);
    background: var(--bg-secondary);
  }

  .chat-style-option:has(input:checked) {
    border-color: var(--accent);
    background: var(--gray-50);
  }

  .chat-style-option input {
    flex-shrink: 0;
    accent-color: var(--accent);
  }

  .chat-style-text {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .chat-style-label {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .chat-style-desc {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .avatar-options {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 0.5rem;
  }

  .avatar-option {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem 1.25rem;
    border: 2px solid var(--border);
    border-radius: 12px;
    background: var(--bg-primary);
    color: var(--text-primary);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    font-family: inherit;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  .avatar-option:hover {
    border-color: var(--gray-300);
    background: var(--bg-secondary);
  }

  .avatar-option.selected {
    border-color: var(--accent);
    background: var(--gray-50);
  }

  .avatar-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    color: var(--text-secondary);
  }

  .avatar-option.selected .avatar-icon {
    color: var(--green-700);
  }

  .avatar-label {
    user-select: none;
  }

  .settings-content {
    flex: 1;
    overflow-y: auto;
  }

  .settings-section {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .settings-section h3 {
    margin: 0 0 1rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--navy-800);
  }

  .setting-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .setting-label {
    flex: 1;
  }

  .setting-name {
    display: block;
    font-weight: 600;
    font-size: 0.9375rem;
    color: var(--text-primary);
    margin-bottom: 0.25rem;
  }

  .setting-desc {
    display: block;
    font-size: 0.8125rem;
    color: var(--gray-600);
    line-height: 1.4;
  }

  .setting-desc.block {
    margin-bottom: 1rem;
  }

  .snippet-add {
    margin-bottom: 1rem;
  }

  .snippet-input,
  .snippet-textarea {
    display: block;
    width: 100%;
    max-width: 320px;
    padding: 0.5rem 0.75rem;
    border: 2px solid var(--border);
    border-radius: 8px;
    font-size: 0.875rem;
    font-family: inherit;
    margin-bottom: 0.5rem;
  }

  .snippet-textarea {
    min-height: 60px;
    resize: vertical;
  }

  .snippet-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .snippet-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border);
    font-size: 0.875rem;
  }

  .snippet-name {
    font-weight: 600;
    color: var(--navy-800);
    min-width: 100px;
  }

  .snippet-body-preview {
    flex: 1;
    color: var(--gray-600);
    font-size: 0.8125rem;
  }

  .snippet-delete {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    background: var(--gray-100);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--gray-700);
    cursor: pointer;
    font-family: inherit;
  }

  .snippet-delete:hover {
    background: var(--gray-200);
  }

  .snippet-empty {
    padding: 1rem 0;
    color: var(--gray-500);
    font-size: 0.875rem;
  }

  .toggle {
    flex-shrink: 0;
    width: 44px;
    height: 24px;
    padding: 0;
    border: none;
    background: none;
    cursor: pointer;
    border-radius: 999px;
  }

  .toggle-track {
    display: block;
    width: 100%;
    height: 100%;
    background: var(--gray-300);
    border-radius: 999px;
    position: relative;
    transition: background-color 0.2s ease;
  }

  .toggle.on .toggle-track {
    background: var(--green-600);
  }

  .toggle-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 20px;
    height: 20px;
    background: var(--white);
    border-radius: 50%;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform 0.2s var(--ease-spring);
  }

  .toggle.on .toggle-thumb {
    transform: translateX(20px);
  }

  .banner {
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    margin-bottom: 0.75rem;
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

  .privacy-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .btn-delete {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: 1px solid var(--gray-400);
    background: var(--card-bg);
    color: var(--gray-700);
    font-size: 0.875rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .btn-delete:hover {
    background: var(--gray-100);
    border-color: var(--gray-500);
  }

  .select-residency {
    padding: 0.5rem 0.75rem;
    border: 2px solid var(--border);
    border-radius: 8px;
    font-size: 0.875rem;
    font-family: inherit;
    background: var(--input-bg);
    color: var(--text-primary);
  }

  .api-key-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .api-key-input {
    max-width: 400px;
    padding: 0.5rem 0.75rem;
    border: 2px solid var(--border);
    border-radius: 8px;
    font-size: 0.875rem;
    font-family: inherit;
    background: var(--input-bg);
    color: var(--text-primary);
  }

  .api-key-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .settings-link {
    color: var(--accent);
    text-decoration: none;
  }

  .settings-link:hover {
    text-decoration: underline;
  }
</style>
