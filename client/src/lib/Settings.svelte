<script>
  import { onMount } from "svelte";
  import { getEnterToSend, setEnterToSend } from "./theme.js";
  import { playClick } from "./theme.js";

  export let onBack = () => {};

  let enterToSend = true;

  onMount(() => {
    enterToSend = getEnterToSend();
  });

  function toggleEnterToSend() {
    enterToSend = !enterToSend;
    setEnterToSend(enterToSend);
    playClick();
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
</style>
