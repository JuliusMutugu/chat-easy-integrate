<script>
  import { onMount, onDestroy } from "svelte";
  import { io } from "socket.io-client";
  import ChatRoom from "./ChatRoom.svelte";
  import RoomList from "./RoomList.svelte";
  import CreateRoom from "./CreateRoom.svelte";
  import Settings from "./Settings.svelte";
  import Integrations from "./Integrations.svelte";
  import { playOpen } from "./theme.js";

  export let config = {
    serverUrl: "http://localhost:3000",
    username: "User",
    theme: "modern",
  };
  export let inviteRoom = null;
  export let inviteToken = null;
  export let onClose = () => {};

  let socket = null;
  let currentView = "rooms";
  let currentRoom = null;
  let rooms = [];
  let isConnected = false;
  let error = null;
  let joinRequest = null;
  let requestToast = "";

  onMount(() => {
    connectToServer();
    if (inviteRoom) {
      currentView = "rooms";
    }
  });

  onDestroy(() => {
    if (socket) {
      socket.off("join-request");
      socket.off("join-approved");
      socket.off("join-declined");
      socket.disconnect();
    }
  });

  function connectToServer() {
    socket = io(config.serverUrl);

    socket.on("connect", () => {
      isConnected = true;
      error = null;
      if (config.username) socket.emit("set-username", { username: config.username });
      loadRooms();
      setupJoinRequestListeners();
    });

    socket.on("disconnect", () => {
      isConnected = false;
    });

    socket.on("connect_error", () => {
      error = "Failed to connect to server";
      isConnected = false;
    });

    socket.on("error", (data) => {
      error = data.message;
    });
  }

  function setupJoinRequestListeners() {
    if (!socket) return;
    socket.on("join-request", (data) => {
      joinRequest = data;
      requestToast = `${data.requesterUsername} requested to join "${data.roomName}".`;
      playOpen();
      setTimeout(() => {
        if (requestToast === `${data.requesterUsername} requested to join "${data.roomName}".`) requestToast = "";
      }, 6000);
    });
    socket.on("join-approved", (data) => {
      requestToast = "";
      currentRoom = {
        id: data.roomId,
        name: data.roomName,
        description: data.roomDescription,
        code: data.roomCode,
        maxUsers: data.maxUsers,
        createdByUsername: data.createdByUsername,
        userCount: data.userCount,
        users: data.users || [],
      };
      currentView = "chat";
    });
    socket.on("join-declined", () => {
      requestToast = "Your request to join was declined.";
      setTimeout(() => (requestToast = ""), 4000);
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

  function handleRequestJoin(inviteTokenParam) {
    if (!socket || !inviteTokenParam) return;
    socket.emit("request-join-room", {
      inviteToken: inviteTokenParam,
      username: config.username,
    });
    requestToast = "Request sent. Waiting for room creator to approve.";
    setTimeout(() => { if (requestToast === "Request sent. Waiting for room creator to approve.") requestToast = ""; }, 5000);
  }

  function handleJoinRequestAccept() {
    if (!socket || !joinRequest) return;
    socket.emit("join-request-accept", { requestId: joinRequest.requestId });
    joinRequest = null;
  }

  function handleJoinRequestDecline() {
    if (!socket || !joinRequest) return;
    socket.emit("join-request-decline", { requestId: joinRequest.requestId });
    joinRequest = null;
  }
</script>

<div class="messaging-root" class:theme-modern={config.theme === "modern"} role="application" aria-labelledby="messaging-title">
  <header class="header">
    <h2 id="messaging-title" class="header-title">Messaging</h2>
    <div class="header-meta">
      <span class="status" class:connected={isConnected}>
        {isConnected ? "Connected" : "Disconnected"}
      </span>
      <button type="button" class="header-link" onclick={onClose} aria-label="Back to home">Home</button>
    </div>
  </header>

  {#if error}
    <div class="banner error" role="alert">
      <span>{error}</span>
      <button type="button" onclick={() => (error = null)} aria-label="Dismiss">Dismiss</button>
    </div>
  {/if}

  {#if requestToast}
    <div class="banner toast" role="status">
      <span>{requestToast}</span>
    </div>
  {/if}

  {#if joinRequest}
    <div class="join-request-overlay" role="dialog" aria-labelledby="join-request-title" aria-modal="true">
      <div class="join-request-panel join-request-panel-pop">
        <div class="join-request-icon" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        </div>
        <h3 id="join-request-title">Someone wants to join</h3>
        <p class="join-request-detail"><strong>{joinRequest.requesterUsername}</strong> requested to join <strong>{joinRequest.roomName}</strong>.</p>
        <p class="join-request-hint">Accept to add them to the room, or decline to reject the request.</p>
        <div class="join-request-actions">
          <button type="button" class="btn-decline" onclick={handleJoinRequestDecline}>Decline</button>
          <button type="button" class="btn-accept" onclick={handleJoinRequestAccept}>Accept</button>
        </div>
      </div>
    </div>
  {/if}

  <div class="layout">
    <nav class="sidebar" aria-label="Messaging navigation">
      <ul class="sidebar-list">
        <li>
          <button
            type="button"
            class="sidebar-item"
            class:active={currentView === "rooms"}
            onclick={() => (currentView = "rooms")}
            aria-current={currentView === "rooms" ? "page" : undefined}
          >
            Rooms
          </button>
        </li>
        <li>
          <button
            type="button"
            class="sidebar-item"
            class:active={currentView === "create"}
            onclick={handleCreateRoom}
            aria-current={currentView === "create" ? "page" : undefined}
          >
            Create room
          </button>
        </li>
        <li>
          <button
            type="button"
            class="sidebar-item sidebar-item-with-badge"
            class:active={currentView === "pending"}
            onclick={() => (currentView = "pending")}
            aria-current={currentView === "pending" ? "page" : undefined}
            aria-label={joinRequest ? "Pending join requests (1)" : "Pending join requests"}
          >
            Pending requests
            {#if joinRequest}
              <span class="sidebar-badge" aria-hidden="true">1</span>
            {/if}
          </button>
        </li>
        <li>
          <button
            type="button"
            class="sidebar-item"
            class:active={currentView === "settings"}
            onclick={() => (currentView = "settings")}
            aria-current={currentView === "settings" ? "page" : undefined}
          >
            Settings
          </button>
        </li>
        <li>
          <button
            type="button"
            class="sidebar-item"
            class:active={currentView === "integrations"}
            onclick={() => (currentView = "integrations")}
            aria-current={currentView === "integrations" ? "page" : undefined}
          >
            Integrations
          </button>
        </li>
        {#if currentView === "chat" && currentRoom}
          <li>
            <button
              type="button"
              class="sidebar-item sidebar-item-chat"
              onclick={handleLeaveRoom}
              aria-label="Back to room list"
            >
              Back to rooms
            </button>
          </li>
        {/if}
      </ul>
    </nav>

    <div class="body">
      {#key currentView}
        {#if currentView === "rooms"}
          <div class="view-wrap view-rooms">
            <RoomList
              {rooms}
              {config}
              {inviteRoom}
              {inviteToken}
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
              onRequestJoin={handleRequestJoin}
              onRefresh={loadRooms}
            />
          </div>
        {:else if currentView === "create"}
          <div class="view-wrap view-create">
            <CreateRoom
              {config}
              onRoomCreated={handleRoomCreated}
              onBack={handleBackToRooms}
            />
          </div>
        {:else if currentView === "pending"}
          <div class="view-wrap view-pending">
            {#if joinRequest}
              <div class="pending-panel">
                <h3>Pending join request</h3>
                <p><strong>{joinRequest.requesterUsername}</strong> wants to join <strong>{joinRequest.roomName}</strong>.</p>
                <div class="pending-actions">
                  <button type="button" class="btn-decline" onclick={handleJoinRequestDecline}>Decline</button>
                  <button type="button" class="btn-accept" onclick={handleJoinRequestAccept}>Accept</button>
                </div>
              </div>
            {:else}
              <div class="pending-empty">
                <p>No pending join requests.</p>
                <p class="pending-empty-hint">When someone uses your invite link and requests to join, they’ll appear here.</p>
              </div>
            {/if}
          </div>
        {:else if currentView === "settings"}
          <div class="view-wrap view-settings">
            <Settings onBack={handleBackToRooms} />
          </div>
        {:else if currentView === "integrations"}
          <div class="view-wrap view-integrations">
            <Integrations {config} onBack={handleBackToRooms} />
          </div>
        {:else if currentView === "chat" && currentRoom}
          <div class="view-wrap view-chat">
            <ChatRoom
              key={currentRoom.id}
              {socket}
              {config}
              room={currentRoom}
              onLeaveRoom={handleLeaveRoom}
            />
          </div>
        {/if}
      {/key}
    </div>
  </div>
</div>

<style>
  .messaging-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 100vh;
    background: var(--bg-primary);
    transition: background-color var(--duration-normal) var(--ease-in-out);
  }

  .layout {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .sidebar {
    width: 220px;
    flex-shrink: 0;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    padding: 1rem 0;
    transition: background-color var(--duration-normal) var(--ease-in-out),
      border-color var(--duration-normal) var(--ease-in-out);
  }

  .sidebar-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .sidebar-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.625rem 1.25rem;
    border: none;
    background: none;
    color: var(--text-secondary);
    font-size: 0.9375rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .sidebar-item:hover {
    background: var(--gray-200);
    color: var(--text-primary);
  }

  .sidebar-item.active {
    background: var(--navy-100);
    color: var(--navy-800);
    border-right: 3px solid var(--green-600);
  }

  .sidebar-item-chat {
    color: var(--green-700);
  }

  .sidebar-item-with-badge {
    position: relative;
    padding-right: 2.25rem;
  }

  .sidebar-badge {
    position: absolute;
    top: 50%;
    right: 1rem;
    transform: translateY(-50%);
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--green-600);
    color: var(--white);
    font-size: 0.6875rem;
    font-weight: 700;
    border-radius: 999px;
  }

  .view-pending {
    padding: 1.5rem;
    overflow-y: auto;
  }

  .pending-panel {
    max-width: 420px;
    margin: 0 auto;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.5rem;
  }

  .pending-panel h3 {
    margin: 0 0 0.75rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--navy-900);
  }

  .pending-panel p {
    margin: 0 0 1rem;
    font-size: 0.9375rem;
    color: var(--gray-700);
  }

  .pending-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .pending-empty {
    text-align: center;
    padding: 3rem 2rem;
    color: var(--gray-600);
  }

  .pending-empty p {
    margin: 0 0 0.5rem;
    font-size: 0.9375rem;
  }

  .pending-empty-hint {
    font-size: 0.8125rem !important;
    color: var(--gray-500) !important;
  }

  .body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
    min-width: 0;
  }

  .view-wrap {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: viewIn 0.3s var(--ease-out-expo);
  }

  @keyframes viewIn {
    from {
      opacity: 0;
      transform: translateX(8px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .header {
    background: var(--navy-800);
    color: var(--white);
    padding: 1rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }

  .header-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .header-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .status {
    font-size: 0.8125rem;
    padding: 0.375rem 0.75rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.15);
    font-weight: 500;
  }

  .status.connected {
    background: var(--green-600);
    color: var(--white);
  }

  .header-link {
    background: rgba(255, 255, 255, 0.15);
    border: none;
    color: var(--white);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .header-link:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .banner {
    padding: 0.75rem 1.25rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
  }

  .banner.error {
    background: var(--bg-secondary);
    color: var(--text-primary);
    border-bottom: 1px solid var(--border);
  }

  .banner button {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    padding: 0.25rem 0.5rem;
    font-family: inherit;
  }

  .banner.toast {
    background: var(--green-100);
    color: var(--green-800);
    border-bottom: 1px solid var(--green-300);
  }

  .join-request-overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
    animation: overlayIn 0.2s ease-out;
  }

  .join-request-panel {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.5rem;
    max-width: 360px;
    width: 100%;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.15);
    animation: panelIn 0.25s ease-out;
  }

  .join-request-panel-pop {
    max-width: 400px;
    padding: 2rem;
    text-align: center;
  }

  .join-request-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--green-100);
    border-radius: 16px;
    color: var(--green-700);
  }

  .join-request-panel h3 {
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--navy-900);
  }

  .join-request-detail {
    margin: 0 0 0.5rem;
    font-size: 1rem;
    color: var(--gray-700);
  }

  .join-request-hint {
    margin: 0 0 1.25rem;
    font-size: 0.8125rem;
    color: var(--gray-500);
    line-height: 1.4;
  }

  .join-request-panel p {
    margin: 0 0 1.25rem;
    font-size: 0.9375rem;
    color: var(--gray-700);
  }

  .join-request-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .join-request-actions .btn-decline {
    background: var(--gray-100);
    border: 1px solid var(--border);
    color: var(--gray-700);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.875rem;
    font-family: inherit;
  }

  .join-request-actions .btn-decline:hover {
    background: var(--gray-200);
  }

  .join-request-actions .btn-accept {
    background: var(--green-600);
    border: none;
    color: var(--white);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.875rem;
    font-family: inherit;
  }

  .join-request-actions .btn-accept:hover {
    background: var(--green-700);
  }

  @keyframes overlayIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes panelIn {
    from { opacity: 0; transform: scale(0.96) translateY(8px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  @media (max-width: 768px) {
    .header {
      padding: 0.875rem 1rem;
    }

    .header-title {
      font-size: 1.125rem;
    }

    .sidebar {
      width: 160px;
      padding: 0.5rem 0;
    }

    .sidebar-item {
      padding: 0.5rem 0.75rem;
      font-size: 0.8125rem;
    }
  }
</style>
