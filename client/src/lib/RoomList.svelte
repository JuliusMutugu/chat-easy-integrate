<script>
  export let rooms = [];
  export const config = {};
  export let inviteRoom = null;
  export let onCreateRoom = () => {};
  export let onJoinRoom = () => {};
  export let onRefresh = () => {};

  let showInviteModal = false;
  let selectedRoom = null;
  let inviteEmail = '';
  let inviteLink = '';

  function formatTime(date) {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function showInvite(room) {
    selectedRoom = room;
    inviteLink = `${window.location.origin}?room=${room.id}&invite=true`;
    showInviteModal = true;
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(inviteLink);
    // Show toast notification
    showToast('Invite link copied to clipboard!');
  }

  function sendEmailInvite() {
    if (!inviteEmail.trim()) return;
    
    const subject = `Join ${selectedRoom.name} on Messaging Platform`;
    const body = `You've been invited to join "${selectedRoom.name}"!\n\nClick here to join: ${inviteLink}\n\nDescription: ${selectedRoom.description}`;
    const mailtoLink = `mailto:${inviteEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    window.open(mailtoLink);
    inviteEmail = '';
    showInviteModal = false;
    showToast('Email invitation opened!');
  }

  function closeInviteModal() {
    showInviteModal = false;
    selectedRoom = null;
    inviteEmail = '';
    inviteLink = '';
  }

  function showToast(message) {
    // Simple toast implementation
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      toast.classList.remove('show');
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
      <button class="create-first-btn" onclick={onCreateRoom}>Create Room</button>
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
            <span class="user-count">👥 {inviteRoom.userCount}/{inviteRoom.maxUsers}</span>
            <span class="room-status" class:full={inviteRoom.userCount >= inviteRoom.maxUsers}>
              {inviteRoom.userCount >= inviteRoom.maxUsers ? 'Full' : 'Available'}
            </span>
          </div>
          
          <div class="room-actions">
            <button 
              class="join-btn priority" 
              disabled={inviteRoom.userCount >= inviteRoom.maxUsers}
              onclick={() => onJoinRoom(inviteRoom)}
            >
              {inviteRoom.userCount >= inviteRoom.maxUsers ? 'Room Full' : '🚀 Join Now'}
            </button>
          </div>
        </div>
      </div>
    {/if}

    <div class="rooms-grid">
      {#each rooms as room}
        <div class="room-card" class:negotiation-active={room.isNegotiationActive}>
          <div class="room-header">
            <h4>{room.name}</h4>
            <div class="room-badges">
              {#if room.isNegotiationActive}
                <span class="negotiation-badge">🤝 Negotiating</span>
              {/if}
              <button class="invite-btn" onclick={() => showInvite(room)} title="Invite others">
                📤
              </button>
            </div>
          </div>
          
          <p class="room-description">{room.description}</p>
          
          <div class="room-stats">
            <span class="user-count">👥 {room.userCount}/{room.maxUsers}</span>
            <span class="room-status" class:full={room.userCount >= room.maxUsers}>
              {room.userCount >= room.maxUsers ? 'Full' : 'Available'}
            </span>
          </div>
          
          <div class="room-actions">
            <button 
              class="join-btn" 
              disabled={room.userCount >= room.maxUsers}
              onclick={() => onJoinRoom(room)}
            >
              {room.userCount >= room.maxUsers ? 'Room Full' : 'Join Room'}
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Invitation Modal -->
  {#if showInviteModal && selectedRoom}
    <div class="modal-overlay" onclick={closeInviteModal}>
      <div class="invite-modal" onclick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h3>📤 Invite to "{selectedRoom.name}"</h3>
          <button class="close-modal-btn" onclick={closeInviteModal}>✕</button>
        </div>
        
        <div class="modal-content">
          <div class="invite-section">
            <h4>🔗 Share Link</h4>
            <div class="link-container">
              <input type="text" readonly value={inviteLink} class="invite-link-input" />
              <button class="copy-btn" onclick={copyInviteLink}>📋 Copy</button>
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
            <h4>📱 Quick Share</h4>
            <div class="quick-share">
              <button class="share-btn whatsapp" onclick={() => window.open(`https://wa.me/?text=${encodeURIComponent('Join me in ' + selectedRoom.name + ': ' + inviteLink)}`)}>
                💬 WhatsApp
              </button>
              <button class="share-btn telegram" onclick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent('Join ' + selectedRoom.name)}`)}>
                ✈️ Telegram
              </button>
              <button class="share-btn twitter" onclick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent('Join me for a discussion: ' + selectedRoom.name)}&url=${encodeURIComponent(inviteLink)}`)}>
                🐦 Twitter
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

  .create-btn, .create-first-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 16px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.3s;
  }

  .create-btn:hover, .create-first-btn:hover {
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

  .link-container, .email-container {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .invite-link-input, .email-input {
    flex: 1;
    padding: 12px;
    border: 2px solid #e1e5e9;
    border-radius: 8px;
    font-size: 14px;
    transition: border-color 0.3s;
  }

  .invite-link-input:focus, .email-input:focus {
    outline: none;
    border-color: #667eea;
  }

  .copy-btn, .send-btn {
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

  .copy-btn:hover, .send-btn:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .quick-share {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
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

  .share-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
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

    .link-container, .email-container {
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
