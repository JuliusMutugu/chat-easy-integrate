<script>
  import { onMount, onDestroy } from "svelte";
  import { io } from "socket.io-client";
  import ChatRoom from "./ChatRoom.svelte";
  import RoomList from "./RoomList.svelte";
  import CreateRoom from "./CreateRoom.svelte";
  import { getServerUrl } from "./config.js";

  export let config = {
    serverUrl: getServerUrl(),
    username: "User",
    theme: "modern",
  };
  export let inviteRoom = null;
  export let isInvitedUser = false;
  export let onClose = () => {};

  let socket = null;
  let currentView = "rooms"; // 'rooms', 'create', 'chat'
  let currentRoom = null;
  let rooms = [];
  let isConnected = false;
  let error = null;

  onMount(() => {
    connectToServer();

    // If there's an invite room, show it prominently
    if (inviteRoom) {
      currentView = "rooms";
    }
  });

  onDestroy(() => {
    if (socket) {
      socket.disconnect();
    }
  });

  function connectToServer() {
    socket = io(config.serverUrl);

    socket.on("connect", () => {
      isConnected = true;
      error = null;
      loadRooms();
    });

    socket.on("disconnect", () => {
      isConnected = false;
    });

    socket.on("connect_error", (err) => {
      error = "Failed to connect to server";
      isConnected = false;
    });

    socket.on("error", (data) => {
      error = data.message;
    });
  }

  async function loadRooms() {
    try {
      const response = await fetch(`${config.serverUrl}/api/rooms`);
      rooms = await response.json();
    } catch (err) {
      error = "Failed to load rooms";
    }
  }

  function handleCreateRoom() {
    currentView = "create";
  }

  function handleJoinRoom(room) {
    currentRoom = room;
    currentView = "chat";
  }

  function handleRoomCreated() {
    currentView = "rooms";
    loadRooms();
  }

  function handleLeaveRoom() {
    currentRoom = null;
    currentView = "rooms";
    loadRooms();
  }

  function handleBackToRooms() {
    currentView = "rooms";
  }
</script>

<div class="messaging-overlay" class:theme-modern={config.theme === "modern"}>
  <div class="messaging-container">
    <div class="messaging-header">
      <h2>💬 Messaging Platform</h2>
      <div class="header-info">
        <span class="connection-status" class:connected={isConnected}>
          {isConnected ? "🟢 Connected" : "🔴 Disconnected"}
        </span>
        <button class="close-btn" onclick={onClose}>✕</button>
      </div>
    </div>

    {#if error}
      <div class="error-message">
        ⚠️ {error}
        <button onclick={() => (error = null)}>×</button>
      </div>
    {/if}

    <div class="messaging-content">
      {#if currentView === "rooms"}
        <RoomList
          {rooms}
          {config}
          {inviteRoom}
          {isInvitedUser}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onRefresh={loadRooms}
        />
      {:else if currentView === "create"}
        <CreateRoom
          {config}
          onRoomCreated={handleRoomCreated}
          onBack={handleBackToRooms}
        />
      {:else if currentView === "chat" && currentRoom}
        <ChatRoom
          {socket}
          {config}
          room={currentRoom}
          onLeaveRoom={handleLeaveRoom}
        />
      {/if}
    </div>
  </div>
</div>

<style>
  .messaging-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 20px;
  }

  .messaging-container {
    background: white;
    border-radius: 16px;
    width: 100%;
    max-width: 900px;
    height: 90vh;
    max-height: 700px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 25px 50px rgba(0, 0, 0, 0.3);
  }

  .messaging-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .messaging-header h2 {
    margin: 0;
    font-size: 1.5em;
  }

  .header-info {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .connection-status {
    font-size: 14px;
    padding: 5px 10px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.2);
  }

  .connection-status.connected {
    background: rgba(76, 175, 80, 0.3);
  }

  .close-btn {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    transition: background-color 0.3s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .error-message {
    background: #ffebee;
    color: #c62828;
    padding: 12px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #ffcdd2;
  }

  .error-message button {
    background: none;
    border: none;
    color: #c62828;
    cursor: pointer;
    font-size: 18px;
    padding: 0;
    width: 20px;
    height: 20px;
  }

  .messaging-content {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  @media (max-width: 768px) {
    .messaging-overlay {
      padding: 10px;
    }

    .messaging-container {
      height: 95vh;
      max-height: none;
    }

    .messaging-header {
      padding: 15px;
    }

    .messaging-header h2 {
      font-size: 1.3em;
    }
  }
</style>
