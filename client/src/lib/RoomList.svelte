<script>
  export let rooms = [];
  export const config = {};
  export let onCreateRoom = () => {};
  export let onJoinRoom = () => {};
  export let onRefresh = () => {};

  function formatTime(date) {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
    <div class="rooms-grid">
      {#each rooms as room}
        <div class="room-card" class:negotiation-active={room.isNegotiationActive}>
          <div class="room-header">
            <h4>{room.name}</h4>
            {#if room.isNegotiationActive}
              <span class="negotiation-badge">🤝 Negotiating</span>
            {/if}
          </div>
          
          <p class="room-description">{room.description}</p>
          
          <div class="room-stats">
            <span class="user-count">👥 {room.userCount}/{room.maxUsers}</span>
            <span class="room-status" class:full={room.userCount >= room.maxUsers}>
              {room.userCount >= room.maxUsers ? 'Full' : 'Available'}
            </span>
          </div>
          
          <button 
            class="join-btn" 
            disabled={room.userCount >= room.maxUsers}
            onclick={() => onJoinRoom(room)}
          >
            {room.userCount >= room.maxUsers ? 'Room Full' : 'Join Room'}
          </button>
        </div>
      {/each}
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

  .negotiation-badge {
    background: #ff9800;
    color: white;
    font-size: 11px;
    padding: 4px 8px;
    border-radius: 12px;
    font-weight: 500;
    white-space: nowrap;
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
  }
</style>
