<script>
  /**
   * Global in-app help chatbot – scoped to app activities only.
   * Uses Gemini via /api/chatbot.
   */
  export let serverUrl = "";

  let open = false;
  let messages = [];
  let input = "";
  let loading = false;
  let error = "";

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    messages = [...messages, { role: "user", content: text }];
    input = "";
    loading = true;
    error = "";

    try {
      const history = messages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch(`${serverUrl}/api/chatbot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: text, history }),
      });

      const data = await res.json();
      if (!res.ok) {
        error = data.error || "Failed to get response";
        messages = messages.slice(0, -1);
        return;
      }
      messages = [...messages, { role: "assistant", content: data.reply }];
    } catch (err) {
      error = err.message || "Network error";
      messages = messages.slice(0, -1);
    } finally {
      loading = false;
    }
  }

  function handleKeydown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }
</script>

<div class="chatbot-wrap" aria-label="Help chatbot">
  {#if open}
    <div class="chatbot-panel" role="dialog" aria-labelledby="chatbot-title">
      <div class="chatbot-header">
        <h3 id="chatbot-title" class="chatbot-title">Help</h3>
        <p class="chatbot-subtitle">Ask about rooms, workflows, agents, deals &amp; more</p>
        <button type="button" class="chatbot-close" onclick={() => (open = false)} aria-label="Close">×</button>
      </div>

      <div class="chatbot-messages" role="log" aria-live="polite">
        {#if messages.length === 0}
          <div class="chatbot-welcome">
            <p>Hi! I'm your Nego assistant. I can help with:</p>
            <ul>
              <li>Creating rooms &amp; inviting people</li>
              <li>Assigning agents (Sales, Marketing, Receptionist)</li>
              <li>Workflows &amp; deal terms</li>
              <li>Inbox, settings &amp; integrations</li>
            </ul>
            <p>What would you like to know?</p>
          </div>
        {:else}
          {#each messages as msg (msg.content + msg.role + messages.indexOf(msg))}
            <div class="chatbot-msg chatbot-msg-{msg.role}">
              {#if msg.role === "user"}
                <span class="chatbot-msg-label">You</span>
              {:else}
                <span class="chatbot-msg-label">Assistant</span>
              {/if}
              <div class="chatbot-msg-content">{msg.content}</div>
            </div>
          {/each}
        {/if}
        {#if loading}
          <div class="chatbot-msg chatbot-msg-assistant chatbot-loading">
            <span class="chatbot-msg-label">Assistant</span>
            <div class="chatbot-msg-content">Thinking...</div>
          </div>
        {/if}
      </div>

      {#if error}
        <div class="chatbot-error" role="alert">{error}</div>
      {/if}

      <form class="chatbot-input-wrap" onsubmit={(e) => { e.preventDefault(); sendMessage(); }}>
        <textarea
          class="chatbot-input"
          placeholder="Ask about the app..."
          bind:value={input}
          onkeydown={handleKeydown}
          disabled={loading}
          rows="1"
        ></textarea>
        <button type="submit" class="chatbot-send" disabled={loading || !input.trim()} aria-label="Send">Send</button>
      </form>
    </div>
  {/if}

  <button
    type="button"
    class="chatbot-toggle"
    onclick={() => (open = !open)}
    aria-expanded={open}
    aria-label={open ? "Close help" : "Open help chatbot"}
    title="Help"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  </button>
</div>

<style>
  .chatbot-wrap {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    z-index: 900;
  }

  .chatbot-toggle {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: none;
    background: var(--green-600);
    color: var(--white);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 16px rgba(34, 197, 94, 0.4);
    transition: transform 0.15s ease, background-color 0.15s ease;
  }

  .chatbot-toggle:hover {
    background: var(--green-700);
    transform: scale(1.05);
  }

  .chatbot-panel {
    position: absolute;
    bottom: 72px;
    right: 0;
    width: 380px;
    max-width: calc(100vw - 3rem);
    height: 560px;
    max-height: 70vh;
    background: var(--card-bg);
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
    border: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .chatbot-header {
    padding: 1rem 1.25rem;
    background: var(--navy-800);
    color: var(--white);
    position: relative;
  }

  .chatbot-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 700;
  }

  .chatbot-subtitle {
    margin: 0.25rem 0 0;
    font-size: 0.8125rem;
    opacity: 0.9;
  }

  .chatbot-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    background: rgba(255, 255, 255, 0.15);
    color: var(--white);
    font-size: 1.25rem;
    line-height: 1;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .chatbot-close:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .chatbot-messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 160px;
    max-height: 380px;
  }

  .chatbot-welcome {
    font-size: 0.9375rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .chatbot-welcome p {
    margin: 0 0 0.5rem;
  }

  .chatbot-welcome ul {
    margin: 0.5rem 0 1rem;
    padding-left: 1.25rem;
  }

  .chatbot-msg {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .chatbot-msg-user .chatbot-msg-content {
    background: var(--green-100);
    color: var(--green-900);
    align-self: flex-end;
  }

  .chatbot-msg-assistant .chatbot-msg-content {
    background: var(--gray-100);
    color: var(--text-primary);
  }

  .chatbot-msg-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .chatbot-msg-content {
    padding: 0.625rem 0.875rem;
    border-radius: 12px;
    font-size: 0.9375rem;
    line-height: 1.5;
    max-width: 90%;
    white-space: pre-wrap;
  }

  .chatbot-loading .chatbot-msg-content {
    opacity: 0.7;
    font-style: italic;
  }

  .chatbot-error {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    color: #dc2626;
    background: #fef2f2;
  }

  .chatbot-input-wrap {
    display: flex;
    gap: 0.5rem;
    padding: 1rem;
    border-top: 1px solid var(--border);
    background: var(--bg-primary);
  }

  .chatbot-input {
    flex: 1;
    padding: 0.625rem 0.875rem;
    font-size: 0.9375rem;
    font-family: inherit;
    border: 1px solid var(--border);
    border-radius: 10px;
    resize: none;
    min-height: 40px;
    max-height: 100px;
    background: var(--card-bg);
    color: var(--text-primary);
  }

  .chatbot-input:focus {
    outline: none;
    border-color: var(--green-600);
  }

  .chatbot-send {
    padding: 0.625rem 1rem;
    font-size: 0.9375rem;
    font-weight: 600;
    font-family: inherit;
    color: var(--white);
    background: var(--green-600);
    border: none;
    border-radius: 10px;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .chatbot-send:hover:not(:disabled) {
    background: var(--green-700);
  }

  .chatbot-send:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 480px) {
    .chatbot-panel {
      width: calc(100vw - 2rem);
      right: -0.5rem;
    }
  }
</style>
