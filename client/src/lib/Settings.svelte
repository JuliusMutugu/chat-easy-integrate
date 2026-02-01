<script>
  import { onMount } from "svelte";
  import { getEnterToSend, setEnterToSend, getCustomSnippets, addCustomSnippet, removeCustomSnippet } from "./theme.js";
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

  onMount(() => {
    enterToSend = getEnterToSend();
    snippets = getCustomSnippets();
  });

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
    <section class="settings-section" aria-labelledby="messaging-heading">
      <h3 id="messaging-heading">Messaging</h3>
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
</style>
