<script>
  import { playClick, playSuccess } from "./theme.js";

  export let config = {};
  export let onRoomCreated = () => {};
  export let onBack = () => {};

  let formData = {
    name: "",
    description: "",
    maxUsers: 10,
  };
  let isSubmitting = false;
  let error = null;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!formData.name.trim()) {
      error = "Room name is required.";
      return;
    }
    isSubmitting = true;
    error = null;
    try {
      const response = await fetch(`${config.serverUrl}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          createdBy: config.username || undefined,
        }),
      });
      if (response.ok) {
        playSuccess();
        onRoomCreated();
      } else {
        error = "Failed to create room.";
      }
    } catch (err) {
      error = "Network error.";
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="create-room">
  <header class="header">
    <button type="button" class="btn-back" onclick={() => { playClick(); onBack(); }}>Back</button>
    <h3 class="title">Create room</h3>
  </header>

  <div class="content">
    <form onsubmit={handleSubmit} class="form">
      {#if error}
        <div class="error-banner" role="alert">
          {error}
        </div>
      {/if}

      <div class="field">
        <label for="roomName">Room name</label>
        <input
          id="roomName"
          type="text"
          bind:value={formData.name}
          placeholder="Enter room name"
          required
          maxlength="50"
        />
      </div>

      <div class="field">
        <label for="roomDescription">Description</label>
        <textarea
          id="roomDescription"
          bind:value={formData.description}
          placeholder="What is this room for?"
          rows="3"
          maxlength="200"
        ></textarea>
        <small>{formData.description.length}/200</small>
      </div>

      <div class="field">
        <label for="maxUsers">Maximum users</label>
        <input
          id="maxUsers"
          type="number"
          bind:value={formData.maxUsers}
          min="2"
          max="50"
        />
        <small>Between 2 and 50</small>
      </div>

      <div class="actions">
        <button type="button" class="btn-cancel" onclick={() => { playClick(); onBack(); }}>
          Cancel
        </button>
        <button type="submit" class="btn-submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating..." : "Create room"}
        </button>
      </div>
    </form>

    <aside class="tips">
      <h4>Tips</h4>
      <ul>
        <li>Use clear, descriptive names</li>
        <li>Set appropriate user limits</li>
        <li>Describe the purpose or topic</li>
        <li>Keep it focused</li>
      </ul>
    </aside>
  </div>
</div>

<style>
  .create-room {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-shrink: 0;
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

  .title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--navy-900);
  }

  .content {
    flex: 1;
    padding: 1.5rem;
    overflow-y: auto;
    display: grid;
    grid-template-columns: 1fr 280px;
    gap: 2rem;
    align-items: start;
  }

  .form {
    background: var(--card-bg);
    border: 1px solid var(--border);
    transition: box-shadow 0.25s ease, background-color var(--duration-normal) var(--ease-in-out);
    border-radius: 12px;
    padding: 1.5rem;
    transition: box-shadow 0.25s ease;
  }

  .form:focus-within {
    box-shadow: 0 0 0 2px var(--green-100);
  }

  .error-banner {
    background: var(--gray-100);
    color: var(--gray-900);
    padding: 0.75rem 1rem;
    border-radius: 8px;
    margin-bottom: 1.25rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: 1px solid var(--gray-300);
  }

  .field {
    margin-bottom: 1.25rem;
  }

  .field:last-of-type {
    margin-bottom: 0;
  }

  .field label {
    display: block;
    margin-bottom: 0.375rem;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--navy-900);
  }

  .field input,
  .field textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid var(--border);
    border-radius: 8px;
    font-size: 0.9375rem;
    font-family: inherit;
    transition: border-color 0.15s ease;
  }

  .field input:focus,
  .field textarea:focus {
    outline: none;
    border-color: var(--green-600);
  }

  .field textarea {
    resize: vertical;
    min-height: 80px;
  }

  .field small {
    display: block;
    margin-top: 0.25rem;
    color: var(--gray-500);
    font-size: 0.75rem;
  }

  .actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .btn-cancel {
    flex: 1;
    background: var(--white);
    border: 2px solid var(--border);
    color: var(--gray-700);
    padding: 0.75rem 1.25rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9375rem;
    font-family: inherit;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .btn-cancel:hover {
    border-color: var(--gray-300);
    background: var(--gray-50);
  }

  .btn-submit {
    flex: 2;
    background: var(--green-600);
    color: var(--white);
    border: none;
    padding: 0.75rem 1.25rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9375rem;
    font-family: inherit;
    transition: background-color 0.15s ease, transform 0.2s var(--ease-spring);
  }

  .btn-submit:hover:not(:disabled) {
    background: var(--green-700);
    transform: translateY(-1px);
  }

  .btn-submit:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  .tips {
    background: var(--bg-secondary);
    border-radius: 12px;
    padding: 1.25rem;
    border: 1px solid var(--border);
  }

  .tips h4 {
    margin: 0 0 0.75rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--navy-900);
  }

  .tips ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .tips li {
    padding: 0.5rem 0;
    color: var(--gray-600);
    font-size: 0.875rem;
    border-bottom: 1px solid var(--border);
    position: relative;
    padding-left: 1.25rem;
  }

  .tips li:last-child {
    border-bottom: none;
  }

  .tips li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0.75rem;
    width: 6px;
    height: 6px;
    background: var(--green-600);
    border-radius: 50%;
  }

  @media (max-width: 768px) {
    .content {
      grid-template-columns: 1fr;
      gap: 1.5rem;
      padding: 1rem;
    }

    .form {
      padding: 1.25rem;
    }

    .actions {
      flex-direction: column;
    }
  }
</style>
