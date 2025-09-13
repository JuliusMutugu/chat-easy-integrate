<script>
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
      error = "Room name is required";
      return;
    }

    isSubmitting = true;
    error = null;

    try {
      const response = await fetch(`${config.serverUrl}/api/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onRoomCreated();
      } else {
        error = "Failed to create room";
      }
    } catch (err) {
      error = "Network error occurred";
    } finally {
      isSubmitting = false;
    }
  }
</script>

<div class="create-room">
  <div class="create-room-header">
    <button class="back-btn" onclick={onBack}>← Back</button>
    <h3>🏠 Create New Room</h3>
  </div>

  <div class="create-room-content">
    <form onsubmit={handleSubmit}>
      {#if error}
        <div class="error-message">
          ⚠️ {error}
        </div>
      {/if}

      <div class="form-group">
        <label for="roomName">Room Name *</label>
        <input
          id="roomName"
          type="text"
          bind:value={formData.name}
          placeholder="Enter room name"
          required
          maxlength="50"
        />
      </div>

      <div class="form-group">
        <label for="roomDescription">Description</label>
        <textarea
          id="roomDescription"
          bind:value={formData.description}
          placeholder="Describe what this room is for..."
          rows="3"
          maxlength="200"
        ></textarea>
        <small>{formData.description.length}/200 characters</small>
      </div>

      <div class="form-group">
        <label for="maxUsers">Maximum Users</label>
        <input
          id="maxUsers"
          type="number"
          bind:value={formData.maxUsers}
          min="2"
          max="50"
        />
        <small>Between 2 and 50 users</small>
      </div>

      <div class="form-actions">
        <button type="button" class="cancel-btn" onclick={onBack}>
          Cancel
        </button>
        <button type="submit" class="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? "⏳ Creating..." : "✨ Create Room"}
        </button>
      </div>
    </form>

    <div class="tips">
      <h4>💡 Tips for great rooms:</h4>
      <ul>
        <li>Use clear, descriptive names</li>
        <li>Set appropriate user limits</li>
        <li>Describe the purpose or topic</li>
        <li>Keep it friendly and inclusive</li>
      </ul>
    </div>
  </div>
</div>

<style>
  .create-room {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .create-room-header {
    padding: 20px;
    border-bottom: 1px solid #e1e5e9;
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .back-btn {
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 8px 12px;
    cursor: pointer;
    transition: all 0.3s;
    font-size: 14px;
  }

  .back-btn:hover {
    background: #e9e9e9;
    transform: translateX(-2px);
  }

  .create-room-header h3 {
    margin: 0;
    color: #333;
    font-size: 1.3em;
  }

  .create-room-content {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 30px;
    align-items: start;
  }

  form {
    background: white;
    border: 1px solid #e1e5e9;
    border-radius: 12px;
    padding: 30px;
  }

  .error-message {
    background: #ffebee;
    color: #c62828;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 20px;
    font-size: 14px;
  }

  .form-group {
    margin-bottom: 20px;
  }

  .form-group label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: #333;
  }

  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 12px;
    border: 2px solid #e1e5e9;
    border-radius: 8px;
    font-size: 14px;
    transition: border-color 0.3s;
    font-family: inherit;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #667eea;
  }

  .form-group textarea {
    resize: vertical;
    min-height: 80px;
  }

  .form-group small {
    display: block;
    margin-top: 5px;
    color: #666;
    font-size: 12px;
  }

  .form-actions {
    display: flex;
    gap: 15px;
    margin-top: 30px;
  }

  .cancel-btn {
    flex: 1;
    background: white;
    border: 2px solid #e1e5e9;
    color: #666;
    padding: 12px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.3s;
  }

  .cancel-btn:hover {
    border-color: #ccc;
    background: #f9f9f9;
  }

  .submit-btn {
    flex: 2;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 12px 20px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.3s;
  }

  .submit-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
  }

  .submit-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  .tips {
    background: #f8f9fa;
    border-radius: 12px;
    padding: 20px;
    height: fit-content;
  }

  .tips h4 {
    margin: 0 0 15px 0;
    color: #333;
    font-size: 1em;
  }

  .tips ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .tips li {
    padding: 8px 0;
    color: #666;
    font-size: 14px;
    border-bottom: 1px solid #e9ecef;
  }

  .tips li:last-child {
    border-bottom: none;
  }

  .tips li:before {
    content: "✓";
    color: #4caf50;
    font-weight: bold;
    margin-right: 10px;
  }

  @media (max-width: 768px) {
    .create-room-content {
      grid-template-columns: 1fr;
      gap: 20px;
      padding: 15px;
    }

    form {
      padding: 20px;
    }

    .form-actions {
      flex-direction: column;
    }
  }
</style>
