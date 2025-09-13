<script>
  export let rooms = [];
  export const config = {};
  export let inviteRoom = null;
  export let onCreateRoom = () => {};
  export let onJoinRoom = () => {};
  export let onRefresh = () => {};

  let showInviteModal = false;
  let selectedRoom = null;
  let inviteEmail = "";
  let inviteLink = "";

  function formatTime(date) {
    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function showInvite(room) {
    selectedRoom = room;
    // Use the persistent invite link from the server or fallback to production URL
    inviteLink =
      room.inviteLink ||
      `${config.serverUrl || "https://chat-easy-integrate.onrender.com"}?room=${room.id}&invite=true`;
    showInviteModal = true;
  }

  async function generateNewInviteLink() {
    if (!selectedRoom) return;

    try {
      const response = await fetch(
        `${config.serverUrl}/api/rooms/${selectedRoom.id}/invite`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }
      );

      if (response.ok) {
        const data = await response.json();
        inviteLink = data.inviteLink;
        showToast("New invite link generated!");
      } else {
        showToast("Failed to generate new invite link.");
      }
    } catch (error) {
      showToast("Error generating invite link.");
    }
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(inviteLink);
    showToast("Invite link copied to clipboard!");
  }

  function copyRoomCode() {
    navigator.clipboard.writeText(selectedRoom.code);
    showToast("Room code copied to clipboard!");
  }

  function sendEmailInvite() {
    if (!inviteEmail.trim()) return;

    const subject = `Join ${selectedRoom.name} - Room Code: ${selectedRoom.code}`;

    // HTML email body
    const htmlBody = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8f9fa; padding: 20px; border-radius: 10px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 20px;">
    <h1 style="margin: 0; font-size: 24px;">🎯 You're Invited!</h1>
    <p style="margin: 10px 0 0 0; font-size: 18px;">Join "${selectedRoom.name}"</p>
  </div>
  
  <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
    <h2 style="color: #333; margin-top: 0;">💬 Quick Join Options:</h2>
    
    <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 15px 0;">
      <p style="margin: 0 0 10px 0; font-weight: bold; color: #1976d2;">🔢 Room Code:</p>
      <p style="font-size: 24px; font-weight: bold; color: #1976d2; margin: 0; font-family: 'Courier New', monospace;">${selectedRoom.code}</p>
    </div>
    
    <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; margin: 15px 0;">
      <p style="margin: 0 0 10px 0; font-weight: bold; color: #2e7d32;">🔗 Direct Link:</p>
      <a href="${inviteLink}" style="color: #2e7d32; font-weight: bold; text-decoration: none; background: #c8e6c9; padding: 10px 15px; border-radius: 5px; display: inline-block;">${inviteLink}</a>
    </div>
    
    <div style="background: #fff3e0; padding: 20px; border-radius: 8px; margin: 15px 0;">
      <p style="margin: 0 0 10px 0; font-weight: bold; color: #f57c00;">📝 Description:</p>
      <p style="margin: 0; color: #f57c00;">${selectedRoom.description}</p>
    </div>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;">
    
    <h3 style="color: #333;">💡 How to join:</h3>
    <ol style="color: #666; line-height: 1.6;">
      <li>Click the direct link above, or</li>
      <li>Visit the messaging platform and enter room code: <strong>${selectedRoom.code}</strong></li>
    </ol>
    
    <p style="text-align: center; margin-top: 30px; color: #666;">
      Looking forward to chatting with you! 😊
    </p>
  </div>
</div>`;

    // Copy HTML to clipboard first
    copyHTMLInvitation(htmlBody);

    // Open mailto with HTML body (most modern email clients support this)
    const mailtoLink = `mailto:${inviteEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(htmlBody)}`;

    window.open(mailtoLink);
    inviteEmail = "";
    showInviteModal = false;
    showToast("HTML invitation copied to clipboard and email opened!");
  }

  async function copyHTMLInvitation(htmlContent) {
    try {
      if (navigator.clipboard && navigator.clipboard.write) {
        // Modern API that supports HTML
        const clipboardItem = new ClipboardItem({
          "text/html": new Blob([htmlContent], { type: "text/html" }),
          "text/plain": new Blob([htmlContent.replace(/<[^>]*>/g, "")], {
            type: "text/plain",
          }),
        });
        await navigator.clipboard.write([clipboardItem]);
      } else {
        // Fallback for older browsers
        await navigator.clipboard.writeText(htmlContent);
      }
    } catch (err) {
      console.warn("Could not copy HTML to clipboard:", err);
    }
  }

  function closeInviteModal() {
    showInviteModal = false;
    selectedRoom = null;
    inviteEmail = "";
    inviteLink = "";
  }

  function showToast(message) {
    // Simple toast implementation
    const toast = document.createElement("div");
    toast.className = "toast-notification";
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("show");
    }, 100);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  }
</script>

<div class="room-list">
  <div class="room-list-header">
    <h3>🏠 Available Rooms</h3>
    <div class="header-actions">
      <button class="refresh-btn" onclick={onRefresh}>🔄</button>
      <button class="create-btn" onclick={onCreateRoom}>➕ Create Room</button>
    </div>
  </div>

  {#if rooms.length === 0}
    <div class="empty-state">
      <div class="empty-icon">🏠</div>
      <h4>No rooms available</h4>
      <p>Create the first room to start chatting!</p>
      <button class="create-first-btn" onclick={onCreateRoom}
        >Create Room</button
      >
    </div>
  {:else}
    {#if inviteRoom}
      <div class="invite-room-section">
        <h4>🎯 You're invited to join:</h4>
        <div class="room-card invite-highlight">
          <div class="room-header">
            <h4>{inviteRoom.name}</h4>
            <div class="room-badges">
              <span class="invite-badge">📤 Invited</span>
            </div>
          </div>

          <p class="room-description">{inviteRoom.description}</p>

          <div class="room-stats">
            <span class="user-count"
              >👥 {inviteRoom.userCount}/{inviteRoom.maxUsers}</span
            >
            <span
              class="room-status"
              class:full={inviteRoom.userCount >= inviteRoom.maxUsers}
            >
              {inviteRoom.userCount >= inviteRoom.maxUsers
                ? "Full"
                : "Available"}
            </span>
          </div>

          <div class="room-actions">
            <button
              class="join-btn priority"
              disabled={inviteRoom.userCount >= inviteRoom.maxUsers}
              onclick={() => onJoinRoom(inviteRoom)}
            >
              {inviteRoom.userCount >= inviteRoom.maxUsers
                ? "Room Full"
                : "🚀 Join Now"}
            </button>
          </div>
        </div>
      </div>
    {/if}

    <div class="rooms-grid">
      {#each rooms as room}
        <div
          class="room-card"
          class:negotiation-active={room.isNegotiationActive}
        >
          <div class="room-header">
            <h4>{room.name}</h4>
            <div class="room-badges">
              {#if room.isNegotiationActive}
                <span class="negotiation-badge">🤝 Negotiating</span>
              {/if}
              <button
                class="invite-btn"
                onclick={() => showInvite(room)}
                title="Invite others"
              >
                Invite
              </button>
            </div>
          </div>

          <p class="room-description">{room.description}</p>

          <div class="room-code-badge">
            <span class="code-label">Code:</span>
            <span class="code-value">{room.code}</span>
          </div>

          <div class="room-stats">
            <span class="user-count">👥 {room.userCount}/{room.maxUsers}</span>
            <span
              class="room-status"
              class:full={room.userCount >= room.maxUsers}
            >
              {room.userCount >= room.maxUsers ? "Full" : "Available"}
            </span>
          </div>

          <div class="room-actions">
            <button
              class="join-btn"
              disabled={room.userCount >= room.maxUsers}
              onclick={() => onJoinRoom(room)}
            >
              {room.userCount >= room.maxUsers ? "Room Full" : "Join Room"}
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Invitation Modal -->
  {#if showInviteModal && selectedRoom}
    <div
      class="modal-overlay"
      role="button"
      tabindex="0"
      onclick={closeInviteModal}
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          closeInviteModal();
        }
      }}
    >
      <div
        class="invite-modal"
        role="dialog"
        tabindex="-1"
        aria-labelledby="invite-modal-title"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
        <div class="modal-header">
          <h3 id="invite-modal-title">📤 Invite to "{selectedRoom.name}"</h3>
          <button class="close-modal-btn" onclick={closeInviteModal}>✕</button>
        </div>

        <div class="modal-content">
          <div class="invite-section">
            <h4>🎯 Room Code</h4>
            <div class="code-container">
              <div class="room-code-display">
                <span class="room-code">{selectedRoom.code}</span>
                <small>Share this code for easy access</small>
              </div>
              <button class="copy-btn" onclick={copyRoomCode}
                >📋 Copy Code</button
              >
            </div>
          </div>

          <div class="invite-section">
            <h4>🔗 Direct Link</h4>
            <div class="link-container">
              <input
                type="text"
                readonly
                value={inviteLink}
                class="invite-link-input"
              />
              <button class="copy-btn" onclick={copyInviteLink}
                >📋 Copy Link</button
              >
            </div>
            <div class="link-actions">
              <button class="generate-btn" onclick={generateNewInviteLink}
                >🔄 Generate New Link</button
              >
              <small class="link-note"
                >Generate a new link if security is compromised</small
              >
            </div>
          </div>

          <div class="invite-section">
            <h4>📧 Email Invitation</h4>
            <div class="email-container">
              <input
                type="email"
                bind:value={inviteEmail}
                placeholder="Enter email address..."
                class="email-input"
              />
              <button
                class="send-btn"
                onclick={sendEmailInvite}
                disabled={!inviteEmail.trim()}
              >
                📧 Send
              </button>
            </div>
          </div>

          <div class="invite-section">
            <h4>📱 Share on Social Platforms</h4>
            <div class="quick-share">
              <button
                class="share-btn whatsapp"
                onclick={() =>
                  window.open(
                    `https://wa.me/?text=${encodeURIComponent(`🎯 *You're invited to join "${selectedRoom.name}"!*\n\n💬 *Room Code:* ${selectedRoom.code}\n🔗 *Click this link to join:* ${inviteLink}\n\n📝 *About:* ${selectedRoom.description}\n\nSee you there! 😊`)}`
                  )}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="1em"
                  height="1em"
                  viewBox="0 0 256 258"
                  {...$$props}
                  ><!-- Icon from SVG Logos by Gil Barbara - https://raw.githubusercontent.com/gilbarbara/logos/master/LICENSE.txt --><defs
                    ><linearGradient
                      id="SVGBRLHCcSy"
                      x1="50%"
                      x2="50%"
                      y1="100%"
                      y2="0%"
                      ><stop offset="0%" stop-color="#1FAF38" /><stop
                        offset="100%"
                        stop-color="#60D669"
                      /></linearGradient
                    ><linearGradient
                      id="SVGHW6lecxh"
                      x1="50%"
                      x2="50%"
                      y1="100%"
                      y2="0%"
                      ><stop offset="0%" stop-color="#F9F9F9" /><stop
                        offset="100%"
                        stop-color="#FFF"
                      /></linearGradient
                    ></defs
                  ><path
                    fill="url(#SVGBRLHCcSy)"
                    d="M5.463 127.456c-.006 21.677 5.658 42.843 16.428 61.499L4.433 252.697l65.232-17.104a123 123 0 0 0 58.8 14.97h.054c67.815 0 123.018-55.183 123.047-123.01c.013-32.867-12.775-63.773-36.009-87.025c-23.23-23.25-54.125-36.061-87.043-36.076c-67.823 0-123.022 55.18-123.05 123.004"
                  /><path
                    fill="url(#SVGHW6lecxh)"
                    d="M1.07 127.416c-.007 22.457 5.86 44.38 17.014 63.704L0 257.147l67.571-17.717c18.618 10.151 39.58 15.503 60.91 15.511h.055c70.248 0 127.434-57.168 127.464-127.423c.012-34.048-13.236-66.065-37.3-90.15C194.633 13.286 162.633.014 128.536 0C58.276 0 1.099 57.16 1.071 127.416m40.24 60.376l-2.523-4.005c-10.606-16.864-16.204-36.352-16.196-56.363C22.614 69.029 70.138 21.52 128.576 21.52c28.3.012 54.896 11.044 74.9 31.06c20.003 20.018 31.01 46.628 31.003 74.93c-.026 58.395-47.551 105.91-105.943 105.91h-.042c-19.013-.01-37.66-5.116-53.922-14.765l-3.87-2.295l-40.098 10.513z"
                  /><path
                    fill="#FFF"
                    d="M96.678 74.148c-2.386-5.303-4.897-5.41-7.166-5.503c-1.858-.08-3.982-.074-6.104-.074c-2.124 0-5.575.799-8.492 3.984c-2.92 3.188-11.148 10.892-11.148 26.561s11.413 30.813 13.004 32.94c1.593 2.123 22.033 35.307 54.405 48.073c26.904 10.609 32.379 8.499 38.218 7.967c5.84-.53 18.844-7.702 21.497-15.139c2.655-7.436 2.655-13.81 1.859-15.142c-.796-1.327-2.92-2.124-6.105-3.716s-18.844-9.298-21.763-10.361c-2.92-1.062-5.043-1.592-7.167 1.597c-2.124 3.184-8.223 10.356-10.082 12.48c-1.857 2.129-3.716 2.394-6.9.801c-3.187-1.598-13.444-4.957-25.613-15.806c-9.468-8.442-15.86-18.867-17.718-22.056c-1.858-3.184-.199-4.91 1.398-6.497c1.431-1.427 3.186-3.719 4.78-5.578c1.588-1.86 2.118-3.187 3.18-5.311c1.063-2.126.531-3.986-.264-5.579c-.798-1.593-6.987-17.343-9.819-23.64"
                  /></svg
                >
              </button>
              <button
                class="share-btn telegram"
                onclick={() =>
                  window.open(
                    `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(`🎯 Join "${selectedRoom.name}"!\n💬 Room Code: ${selectedRoom.code}`)}`
                  )}
              >
                  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 256 256" {...$$props}><!-- Icon from SVG Logos by Gil Barbara - https://raw.githubusercontent.com/gilbarbara/logos/master/LICENSE.txt --><defs><linearGradient id="SVGuySfwdaH" x1="50%" x2="50%" y1="0%" y2="100%"><stop offset="0%" stop-color="#2AABEE"/><stop offset="100%" stop-color="#229ED9"/></linearGradient></defs><path fill="url(#SVGuySfwdaH)" d="M128 0C94.06 0 61.48 13.494 37.5 37.49A128.04 128.04 0 0 0 0 128c0 33.934 13.5 66.514 37.5 90.51C61.48 242.506 94.06 256 128 256s66.52-13.494 90.5-37.49c24-23.996 37.5-56.576 37.5-90.51s-13.5-66.514-37.5-90.51C194.52 13.494 161.94 0 128 0"/><path fill="#FFF" d="M57.94 126.648q55.98-24.384 74.64-32.152c35.56-14.786 42.94-17.354 47.76-17.441c1.06-.017 3.42.245 4.96 1.49c1.28 1.05 1.64 2.47 1.82 3.467c.16.996.38 3.266.2 5.038c-1.92 20.24-10.26 69.356-14.5 92.026c-1.78 9.592-5.32 12.808-8.74 13.122c-7.44.684-13.08-4.912-20.28-9.63c-11.26-7.386-17.62-11.982-28.56-19.188c-12.64-8.328-4.44-12.906 2.76-20.386c1.88-1.958 34.64-31.748 35.26-34.45c.08-.338.16-1.598-.6-2.262c-.74-.666-1.84-.438-2.64-.258c-1.14.256-19.12 12.152-54 35.686c-5.1 3.508-9.72 5.218-13.88 5.128c-4.56-.098-13.36-2.584-19.9-4.708c-8-2.606-14.38-3.984-13.82-8.41c.28-2.304 3.46-4.662 9.52-7.072"/></svg>
              </button>
              <button
                class="share-btn twitter"
                onclick={() =>
                  window.open(
                    `https://twitter.com/intent/tweet?text=${encodeURIComponent(`🎯 Join me for a discussion in "${selectedRoom.name}"!\n💬 Room Code: ${selectedRoom.code}`)}&url=${encodeURIComponent(inviteLink)}`
                  )}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...$$props}><!-- Icon from Material Line Icons by Vjacheslav Trushkin - https://github.com/cyberalien/line-md/blob/master/license.txt --><g fill="currentColor"><path d="M1 2h2.5L3.5 2h-2.5zM5.5 2h2.5L7.2 2h-2.5z"><animate fill="freeze" attributeName="d" dur="0.4s" values="M1 2h2.5L3.5 2h-2.5zM5.5 2h2.5L7.2 2h-2.5z;M1 2h2.5L18.5 22h-2.5zM5.5 2h2.5L23 22h-2.5z"/></path><path d="M3 2h5v0h-5zM16 22h5v0h-5z"><animate fill="freeze" attributeName="d" begin="0.4s" dur="0.4s" values="M3 2h5v0h-5zM16 22h5v0h-5z;M3 2h5v2h-5zM16 22h5v-2h-5z"/></path><path d="M18.5 2h3.5L22 2h-3.5z"><animate fill="freeze" attributeName="d" begin="0.5s" dur="0.4s" values="M18.5 2h3.5L22 2h-3.5z;M18.5 2h3.5L5 22h-3.5z"/></path></g></svg>
              </button>
              <button
                class="share-btn messenger"
                onclick={() =>
                  window.open(
                    `https://www.facebook.com/dialog/send?link=${encodeURIComponent(inviteLink)}&app_id=YOUR_APP_ID`
                  )}
              >
                  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 14 14" {...$$props}><!-- Icon from Flex color icons by Streamline - https://creativecommons.org/licenses/by/4.0/ --><path fill="#8fbffa" d="M3.677 13.107a3.166 3.166 0 0 1-2.783-2.79C.78 9.242.682 8.138.682 7.013s.097-2.23.212-3.304A3.166 3.166 0 0 1 3.677.919C4.758.799 5.868.695 7 .695s2.242.103 3.323.224a3.166 3.166 0 0 1 2.783 2.79c.115 1.075.212 2.179.212 3.304s-.097 2.229-.212 3.304a3.166 3.166 0 0 1-2.783 2.79q-.63.07-1.273.127a.493.493 0 0 1-.534-.494v-2.695h1.522a.5.5 0 0 0 .5-.5V8.018a.5.5 0 0 0-.5-.5H8.516v-1.01a1.01 1.01 0 0 1 1.011-1.011h.511a.5.5 0 0 0 .5-.5V3.98a1.01 1.01 0 0 0-1.01-1.01h-.506a3.033 3.033 0 0 0-3.033 3.032v1.516H4.467a.5.5 0 0 0-.5.5v1.527a.5.5 0 0 0 .5.5H5.99v2.735a.49.49 0 0 1-.524.494a42 42 0 0 1-1.788-.167Z"/></svg>
              </button>
            </div>
          </div>

          <div class="invite-section">
            <h4>📋 Quick Copy Messages</h4>
            <div class="quick-messages">
              <button
                class="message-btn"
                onclick={() => {
                  navigator.clipboard.writeText(
                    `Hey! Join me in "${selectedRoom.name}" - Room Code: ${selectedRoom.code}`
                  );
                  showToast("Message copied!");
                }}
              >
                💬 Simple Message
              </button>
              <button
                class="message-btn"
                onclick={() => {
                  navigator.clipboard.writeText(
                    `🎯 You're invited to join "${selectedRoom.name}"!\n\n💬 Room Code: ${selectedRoom.code}\n🔗 Link: ${inviteLink}\n\n📝 ${selectedRoom.description}`
                  );
                  showToast("Detailed message copied!");
                }}
              >
                📄 Detailed Message
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .room-list {
    padding: 20px;
    height: 100%;
    overflow-y: auto;
  }

  .room-list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    flex-wrap: wrap;
    gap: 10px;
  }

  .room-list-header h3 {
    margin: 0;
    color: #333;
    font-size: 1.3em;
  }

  .header-actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .refresh-btn {
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.3s;
  }

  .refresh-btn:hover {
    background: #e9e9e9;
    transform: rotate(180deg);
  }

  .create-btn,
  .create-first-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 16px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.3s;
  }

  .create-btn:hover,
  .create-first-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #666;
  }

  .empty-icon {
    font-size: 4em;
    margin-bottom: 20px;
  }

  .empty-state h4 {
    margin-bottom: 10px;
    color: #333;
  }

  .empty-state p {
    margin-bottom: 30px;
    font-size: 14px;
  }

  .invite-room-section {
    margin-bottom: 30px;
    padding: 20px;
    background: linear-gradient(135deg, #fff3e0 0%, #ffffff 100%);
    border-radius: 12px;
    border: 2px solid #ff9800;
  }

  .invite-room-section h4 {
    margin: 0 0 15px 0;
    color: #e65100;
    font-size: 1.1em;
    text-align: center;
  }

  .invite-highlight {
    border: 2px solid #ff9800 !important;
    background: linear-gradient(135deg, #fff8e1 0%, #ffffff 100%) !important;
    box-shadow: 0 8px 25px rgba(255, 152, 0, 0.2) !important;
    transform: scale(1.02);
  }

  .invite-badge {
    background: #ff9800;
    color: white;
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 12px;
    font-weight: 500;
    white-space: nowrap;
  }

  .join-btn.priority {
    background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
    font-weight: 600;
    box-shadow: 0 4px 15px rgba(255, 152, 0, 0.3);
  }

  .join-btn.priority:hover:not(:disabled) {
    box-shadow: 0 6px 20px rgba(255, 152, 0, 0.5);
  }

  .rooms-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
  }

  .room-card {
    background: white;
    border: 2px solid #e1e5e9;
    border-radius: 12px;
    padding: 20px;
    transition: all 0.3s;
    position: relative;
  }

  .room-card:hover {
    border-color: #667eea;
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  }

  .room-card.negotiation-active {
    border-color: #ff9800;
    background: linear-gradient(135deg, #fff3e0 0%, #ffffff 100%);
  }

  .room-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 10px;
    flex-wrap: wrap;
    gap: 10px;
  }

  .room-header h4 {
    margin: 0;
    color: #333;
    font-size: 1.1em;
    flex: 1;
  }

  .room-badges {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .negotiation-badge {
    background: #ff9800;
    color: white;
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 12px;
    font-weight: 500;
    white-space: nowrap;
  }

  .invite-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border: none;
    border-radius: 6px;
    width: 28px;
    height: 28px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .invite-btn:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }

  .room-description {
    color: #666;
    font-size: 14px;
    margin-bottom: 15px;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .room-code-badge {
    background: #f1f3f4;
    border: 1px solid #e1e5e9;
    border-radius: 6px;
    padding: 6px 10px;
    margin-bottom: 15px;
    text-align: center;
    font-size: 13px;
  }

  .code-label {
    color: #666;
    margin-right: 5px;
  }

  .code-value {
    font-family: "Courier New", monospace;
    font-weight: bold;
    color: #333;
    letter-spacing: 1px;
  }

  .room-stats {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    font-size: 13px;
  }

  .user-count {
    color: #555;
  }

  .room-status {
    padding: 4px 8px;
    border-radius: 12px;
    background: #e8f5e8;
    color: #2e7d32;
    font-weight: 500;
  }

  .room-status.full {
    background: #ffebee;
    color: #c62828;
  }

  .room-actions {
    margin-top: 15px;
  }

  .join-btn {
    width: 100%;
    background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 12px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.3s;
  }

  .join-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.4);
  }

  .join-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
  }

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 20px;
  }

  .invite-modal {
    background: white;
    border-radius: 16px;
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
  }

  .modal-header {
    padding: 20px;
    border-bottom: 1px solid #e1e5e9;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 16px 16px 0 0;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.2em;
  }

  .close-modal-btn {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 16px;
    transition: background-color 0.3s;
  }

  .close-modal-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .modal-content {
    padding: 20px;
  }

  .invite-section {
    margin-bottom: 25px;
  }

  .invite-section h4 {
    margin: 0 0 12px 0;
    color: #333;
    font-size: 1em;
  }

  .code-container {
    display: flex;
    gap: 15px;
    align-items: center;
  }

  .room-code-display {
    flex: 1;
    text-align: center;
    padding: 15px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    color: white;
  }

  .room-code {
    display: block;
    font-size: 24px;
    font-weight: bold;
    font-family: "Courier New", monospace;
    letter-spacing: 3px;
    margin-bottom: 5px;
  }

  .room-code-display small {
    font-size: 12px;
    opacity: 0.9;
  }

  .link-container,
  .email-container {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .invite-link-input,
  .email-input {
    flex: 1;
    padding: 12px;
    border: 2px solid #e1e5e9;
    border-radius: 8px;
    font-size: 14px;
    transition: border-color 0.3s;
  }

  .invite-link-input:focus,
  .email-input:focus {
    outline: none;
    border-color: #667eea;
  }

  .copy-btn,
  .send-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    padding: 12px 16px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.3s;
    white-space: nowrap;
  }

  .copy-btn:hover,
  .send-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .link-actions {
    margin-top: 10px;
    text-align: center;
  }

  .generate-btn {
    background: #8b5cf6;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    transition: all 0.3s;
    margin-bottom: 5px;
  }

  .generate-btn:hover {
    background: #7c3aed;
    transform: translateY(-1px);
  }

  .invite-description {
    color: #6b7280;
    font-size: 13px;
    margin: 8px 0;
    text-align: center;
  }

  .link-note {
    display: block;
    color: #6b7280;
    font-size: 12px;
    margin-top: 5px;
  }

  .quick-share {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 10px;
  }

  .share-btn {
    padding: 10px 12px;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.3s;
    text-align: center;
  }

  .share-btn.whatsapp {
    background: #25d366;
    color: white;
  }

  .share-btn.telegram {
    background: #0088cc;
    color: white;
  }

  .share-btn.twitter {
    background: #1da1f2;
    color: white;
  }

  .share-btn.messenger {
    background: #006aff;
    color: white;
  }

  .share-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .quick-messages {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .message-btn {
    flex: 1;
    min-width: 150px;
    background: #f8f9fa;
    border: 2px solid #e1e5e9;
    color: #333;
    padding: 10px 15px;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.3s;
  }

  .message-btn:hover {
    border-color: #667eea;
    background: #f0f2ff;
    transform: translateY(-1px);
  }

  /* Global Toast Styles */
  :global(.toast-notification) {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4caf50;
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 3000;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    font-weight: 500;
  }

  :global(.toast-notification.show) {
    transform: translateX(0);
  }

  @media (max-width: 768px) {
    .room-list {
      padding: 15px;
    }

    .rooms-grid {
      grid-template-columns: 1fr;
      gap: 15px;
    }

    .room-card {
      padding: 15px;
    }

    .room-badges {
      flex-direction: column;
      align-items: flex-end;
      gap: 6px;
    }

    .invite-modal {
      margin: 10px;
      max-width: calc(100% - 20px);
    }

    .modal-content {
      padding: 15px;
    }

    .quick-share {
      grid-template-columns: 1fr;
    }

    .link-container,
    .email-container {
      flex-direction: column;
      align-items: stretch;
    }

    :global(.toast-notification) {
      right: 10px;
      left: 10px;
      transform: translateY(-100%);
    }

    :global(.toast-notification.show) {
      transform: translateY(0);
    }
  }
</style>
