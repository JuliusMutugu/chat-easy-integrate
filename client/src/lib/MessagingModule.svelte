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
  let pendingRequests = [];
  let notifications = [];
  let profileDropdownOpen = false;

  onMount(() => {
    connectToServer();
    if (inviteRoom) {
      currentView = "rooms";
    }
    addNotification("welcome", `Welcome back, ${config.username}`, 30000);
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
      loadPendingRequests();
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

  function addNotification(type, message, durationMs = 6000) {
    const id = "n-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
    notifications = [...notifications, { id, type, message }];
    if (durationMs > 0) {
      setTimeout(() => {
        notifications = notifications.filter((n) => n.id !== id);
      }, durationMs);
    }
    return id;
  }

  function dismissNotification(id) {
    notifications = notifications.filter((n) => n.id !== id);
  }

  function setupJoinRequestListeners() {
    if (!socket) return;
    socket.on("join-request", (data) => {
      const existing = pendingRequests.find((p) => p.requestId === data.requestId);
      if (!existing) {
        pendingRequests = [
          {
            requestId: data.requestId,
            roomId: data.roomId,
            roomName: data.roomName,
            requesterUsername: data.requesterUsername,
          },
          ...pendingRequests,
        ];
      }
      addNotification("info", `${data.requesterUsername} requested to join "${data.roomName}".`, 8000);
      playOpen();
    });
    socket.on("join-approved", (data) => {
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
      pendingRequests = pendingRequests.filter((p) => p.roomId !== data.roomId);
    });
    socket.on("join-declined", () => {
      addNotification("warning", "Your request to join was declined.", 5000);
    });
  }

  async function loadPendingRequests() {
    if (!config.username) return;
    try {
      const res = await fetch(
        `${config.serverUrl}/api/rooms/pending-requests?creator=${encodeURIComponent(config.username)}`
      );
      const list = await res.json();
      pendingRequests = (list || []).map((p) => ({
        requestId: p.requestId,
        roomId: p.roomId,
        roomName: p.roomName,
        requesterUsername: p.requesterUsername,
      }));
    } catch (_) {
      pendingRequests = [];
    }
  }

  async function loadRooms() {
    try {
      const url = config.username
        ? `${config.serverUrl}/api/rooms?username=${encodeURIComponent(config.username)}`
        : `${config.serverUrl}/api/rooms`;
      const response = await fetch(url);
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
    addNotification("info", "Request sent. Waiting for room creator to approve.", 5000);
  }

  function handleJoinRequestAccept(requestId) {
    if (!socket) return;
    socket.emit("join-request-accept", { requestId });
    pendingRequests = pendingRequests.filter((p) => p.requestId !== requestId);
  }

  function handleJoinRequestDecline(requestId) {
    if (!socket) return;
    socket.emit("join-request-decline", { requestId });
    pendingRequests = pendingRequests.filter((p) => p.requestId !== requestId);
  }

  function handleOpenPending() {
    currentView = "pending";
    loadPendingRequests();
  }

  function closeProfileDropdown() {
    profileDropdownOpen = false;
  }
</script>

<svelte:window on:click={() => profileDropdownOpen && closeProfileDropdown()} />


<div class="messaging-root" class:theme-modern={config.theme === "modern"} role="application" aria-labelledby="app-title">
  <header class="header">
    <h2 id="app-title" class="header-title">
      {#if currentView === "chat" && currentRoom}
        <span class="header-room-context">
          <span class="header-room-name">{currentRoom.name}</span>
          <span class="header-room-sub">Room</span>
        </span>
      {:else}
        <img src="/images/logo.jpg" alt="Nego" class="header-logo-img" />
        <span>Nego</span>
      {/if}
    </h2>
    <div class="header-meta">
      <span class="status" class:connected={isConnected}>
        {isConnected ? "Connected" : "Disconnected"}
      </span>
      <button type="button" class="header-link" onclick={onClose} aria-label="Back to home">Home</button>
      <div class="header-profile-wrap" role="presentation" onclick={(e) => e.stopPropagation()}>
        <button
          type="button"
          class="header-profile-btn"
          onclick={() => profileDropdownOpen = !profileDropdownOpen}
          aria-expanded={profileDropdownOpen}
          aria-haspopup="true"
          aria-label="Profile and account"
        >
          <span class="header-profile-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M6.168 18.849A4 4 0 0 1 10 16h4a4 4 0 0 1 3.834 2.855"/></svg>
          </span>
        </button>
        {#if profileDropdownOpen}
          <div class="header-profile-dropdown" role="menu">
            <button type="button" class="header-profile-item" role="menuitem" onclick={() => { profileDropdownOpen = false; currentView = 'settings'; }}>Manage profile</button>
            <button type="button" class="header-profile-item" role="menuitem" onclick={() => { profileDropdownOpen = false; currentView = 'settings'; }}>Manage account</button>
            <button type="button" class="header-profile-item header-profile-signout" role="menuitem" onclick={() => { profileDropdownOpen = false; onClose(); }}>Sign out</button>
          </div>
        {/if}
      </div>
    </div>
  </header>

  {#if error}
    <div class="banner error" role="alert">
      <span>{error}</span>
      <button type="button" onclick={() => (error = null)} aria-label="Dismiss">Dismiss</button>
    </div>
  {/if}

  <div class="notifications-stack" aria-live="polite">
    {#each notifications as n (n.id)}
      <div class="notification-toast notification-{n.type}" role="status">
        <span class="notification-message">{n.message}</span>
        <button type="button" class="notification-dismiss" onclick={() => dismissNotification(n.id)} aria-label="Dismiss">×</button>
      </div>
    {/each}
  </div>

  <div class="layout">
    <nav class="sidebar" aria-label="Nego navigation">
      <div class="sidebar-brand" aria-hidden="true">
        <span class="sidebar-brand-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </span>
        <span class="sidebar-brand-text">Nego</span>
      </div>
      <ul class="sidebar-list">
        <li>
          <button
            type="button"
            class="sidebar-item"
            class:active={currentView === "rooms"}
            onclick={() => (currentView = "rooms")}
            aria-current={currentView === "rooms" ? "page" : undefined}
          >
            <span class="sidebar-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            </span>
            <span class="sidebar-label">Rooms</span>
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
            <span class="sidebar-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </span>
            <span class="sidebar-label">Create room</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            class="sidebar-item sidebar-item-with-badge"
            class:active={currentView === "pending"}
            onclick={handleOpenPending}
            aria-current={currentView === "pending" ? "page" : undefined}
            aria-label={pendingRequests.length ? `Pending join requests (${pendingRequests.length})` : "Pending join requests"}
          >
            <span class="sidebar-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
            </span>
            <span class="sidebar-label">Pending</span>
            {#if pendingRequests.length > 0}
              <span class="sidebar-badge" aria-hidden="true">{pendingRequests.length}</span>
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
            <span class="sidebar-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </span>
            <span class="sidebar-label">Settings</span>
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
            <span class="sidebar-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </span>
            <span class="sidebar-label">Integrations</span>
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
              <span class="sidebar-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </span>
              <span class="sidebar-label">Back to rooms</span>
            </button>
          </li>
        {/if}
      </ul>
    </nav>

    <div class="body">
      {#key currentView}
        {#if currentView === "rooms"}
          <div class="view-wrap view-rooms dashboard-view">
            <div class="dashboard-quick-actions">
              <button type="button" class="quick-action-card" onclick={handleCreateRoom} aria-label="Create a new room">
                <span class="quick-action-icon quick-action-icon-create" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </span>
                <span class="quick-action-title">Create room</span>
                <span class="quick-action-desc">Start a new conversation or deal</span>
              </button>
              <button type="button" class="quick-action-card" onclick={handleOpenPending} aria-label="Pending join requests">
                <span class="quick-action-icon quick-action-icon-pending" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                </span>
                <span class="quick-action-title">Pending</span>
                <span class="quick-action-desc">Review join requests</span>
                {#if pendingRequests.length > 0}
                  <span class="quick-action-badge">{pendingRequests.length}</span>
                {/if}
              </button>
              <button type="button" class="quick-action-card" onclick={() => (currentView = "settings")} aria-label="Settings and preferences">
                <span class="quick-action-icon quick-action-icon-settings" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                </span>
                <span class="quick-action-title">Settings</span>
                <span class="quick-action-desc">Snippets, privacy, theme</span>
              </button>
              <button type="button" class="quick-action-card" onclick={() => (currentView = "integrations")} aria-label="Integrations and channels">
                <span class="quick-action-icon quick-action-icon-integrations" aria-hidden="true">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                </span>
                <span class="quick-action-title">Integrations</span>
                <span class="quick-action-desc">Email, SMS, payments, KYC</span>
              </button>
            </div>
            <section class="dashboard-rooms-section" aria-labelledby="your-rooms-heading">
              <h2 id="your-rooms-heading" class="dashboard-section-title">Your rooms</h2>
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
            </section>
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
            <div class="pending-header">
              <button type="button" class="btn-back-pending" onclick={() => { playClick(); handleBackToRooms(); }}>Back</button>
              <h2 class="pending-page-title">Pending join requests</h2>
            </div>
            {#if pendingRequests.length === 0}
              <div class="pending-empty">
                <p>No pending join requests.</p>
                <p class="pending-empty-hint">When someone uses your invite link and requests to join, they’ll appear here.</p>
              </div>
            {:else}
              <ul class="pending-list">
                {#each pendingRequests as req (req.requestId)}
                  <li class="pending-item">
                    <div class="pending-item-main">
                      <strong>{req.requesterUsername}</strong> requested to join <strong>{req.roomName}</strong>
                    </div>
                    <div class="pending-item-actions">
                      <button type="button" class="btn-decline" onclick={() => handleJoinRequestDecline(req.requestId)}>Decline</button>
                      <button type="button" class="btn-accept" onclick={() => handleJoinRequestAccept(req.requestId)}>Accept</button>
                    </div>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        {:else if currentView === "settings"}
          <div class="view-wrap view-settings">
            <Settings onBack={handleBackToRooms} config={config} username={config.username} />
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
    width: 240px;
    flex-shrink: 0;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    padding: 1rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    transition: background-color var(--duration-normal) var(--ease-in-out),
      border-color var(--duration-normal) var(--ease-in-out);
  }

  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1.25rem 1rem;
    margin-bottom: 0.25rem;
    border-bottom: 1px solid var(--border);
  }

  .sidebar-brand-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, var(--navy-700) 0%, var(--navy-800) 100%);
    color: var(--white);
    border-radius: 10px;
    flex-shrink: 0;
  }

  .sidebar-brand-text {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  .sidebar-list {
    list-style: none;
    padding: 0;
    margin: 0;
    flex: 1;
  }

  .sidebar-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
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
    position: relative;
  }

  .sidebar-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    opacity: 0.85;
  }

  .sidebar-item:hover .sidebar-icon {
    opacity: 1;
  }

  .sidebar-label {
    flex: 1;
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

  .sidebar-item.active .sidebar-icon {
    color: var(--green-700);
    opacity: 1;
  }

  .sidebar-item-chat {
    color: var(--green-700);
  }

  .sidebar-item-chat .sidebar-icon {
    color: var(--green-600);
  }

  .sidebar-item-with-badge {
    position: relative;
    padding-right: 2.5rem;
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

  /* Dashboard (rooms view) */
  .dashboard-view {
    overflow-y: auto;
    padding-bottom: 2rem;
  }

  .dashboard-hero {
    background: linear-gradient(135deg, var(--navy-800) 0%, var(--navy-900) 100%);
    color: var(--white);
    padding: 2rem 1.5rem;
    margin: 0 0 1.5rem;
    border-radius: 0 0 20px 20px;
    box-shadow: 0 12px 40px rgba(13, 33, 55, 0.2);
  }

  .dashboard-hero-inner {
    max-width: 720px;
    display: flex;
    align-items: flex-start;
    gap: 1.25rem;
  }

  .dashboard-hero-icon {
    width: 56px;
    height: 56px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.12);
    border-radius: 14px;
    color: rgba(255, 255, 255, 0.95);
  }

  .dashboard-hero-text {
    flex: 1;
    min-width: 0;
  }

  .dashboard-hero-title {
    margin: 0 0 0.35rem;
    font-size: clamp(1.375rem, 2.5vw, 1.75rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  .dashboard-hero-name {
    color: var(--green-400);
    font-weight: 700;
  }

  .dashboard-hero-subtitle {
    margin: 0;
    font-size: 0.9375rem;
    opacity: 0.9;
    line-height: 1.45;
  }

  .dashboard-quick-actions {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1rem;
    padding: 0 1.5rem 1.5rem;
    max-width: 960px;
  }

  .quick-action-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 1.25rem;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 14px;
    cursor: pointer;
    font-family: inherit;
    text-align: left;
    transition: transform 0.2s var(--ease-spring), box-shadow 0.2s ease, border-color 0.2s ease;
    position: relative;
  }

  .quick-action-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 28px rgba(13, 33, 55, 0.1);
    border-color: var(--navy-400);
  }

  .quick-action-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    flex-shrink: 0;
  }

  .quick-action-icon-create {
    background: var(--green-100);
    color: var(--green-700);
  }

  .quick-action-icon-pending {
    background: var(--navy-100);
    color: var(--navy-700);
  }

  .quick-action-icon-settings {
    background: var(--gray-100);
    color: var(--gray-700);
  }

  .quick-action-icon-integrations {
    background: var(--navy-100);
    color: var(--navy-700);
  }

  .quick-action-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .quick-action-desc {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    line-height: 1.35;
  }

  .quick-action-badge {
    position: absolute;
    top: 1rem;
    right: 1rem;
    min-width: 20px;
    height: 20px;
    padding: 0 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--green-600);
    color: var(--white);
    font-size: 0.6875rem;
    font-weight: 700;
    border-radius: 999px;
  }

  .dashboard-rooms-section {
    padding: 0 1.5rem 1.5rem;
  }

  .dashboard-section-title {
    margin: 0 0 1rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .dashboard-rooms-section :global(.room-list) {
    padding: 0.5rem 0 1.5rem 0;
  }

  .dashboard-rooms-section :global(.list-header) {
    margin-bottom: 1rem;
  }

  .dashboard-rooms-section :global(.list-title) {
    display: none;
  }

  .view-pending {
    padding: 1.5rem;
    overflow-y: auto;
  }

  .pending-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .btn-back-pending {
    background: var(--gray-100);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--gray-700);
    font-family: inherit;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .btn-back-pending:hover {
    background: var(--gray-200);
    border-color: var(--gray-300);
  }

  .pending-page-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .pending-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .pending-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    flex-wrap: wrap;
  }

  .pending-item-main {
    flex: 1;
    min-width: 0;
    font-size: 0.9375rem;
    color: var(--text-primary);
  }

  .pending-item-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .pending-item-actions .btn-decline,
  .pending-item-actions .btn-accept {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }

  .pending-item-actions .btn-decline {
    background: var(--gray-100);
    border: 1px solid var(--border);
    color: var(--gray-700);
  }

  .pending-item-actions .btn-decline:hover {
    background: var(--gray-200);
  }

  .pending-item-actions .btn-accept {
    background: var(--green-600);
    border: none;
    color: var(--white);
  }

  .pending-item-actions .btn-accept:hover {
    background: var(--green-700);
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
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 1rem 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-shrink: 0;
    border-bottom: 1px solid var(--border);
    transition: background-color var(--duration-normal) var(--ease-in-out),
      color var(--duration-normal) var(--ease-in-out),
      border-color var(--duration-normal) var(--ease-in-out);
  }

  .header-title {
    margin: 0;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: -0.02em;
  }

  .header-room-context {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.125rem;
  }

  .header-room-name {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .header-room-sub {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .header-logo-img {
    width: 28px;
    height: 28px;
    min-width: 28px;
    min-height: 28px;
    object-fit: cover;
    flex-shrink: 0;
    border-radius: 50%;
  }

  :global([data-theme="dark"]) .header-logo-img {
    filter: brightness(0) invert(1);
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
    background: var(--bg-secondary);
    color: var(--text-secondary);
    border: 1px solid var(--border);
    font-weight: 500;
  }

  .status.connected {
    background: var(--green-600);
    color: var(--white);
    border-color: var(--green-600);
  }

  .header-link {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    color: var(--text-primary);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }

  .header-link:hover {
    background: var(--gray-200);
    border-color: var(--gray-300);
  }

  :global([data-theme="dark"]) .header-link:hover {
    background: var(--gray-100);
    border-color: var(--gray-200);
  }

  .header-profile-wrap {
    position: relative;
  }

  .header-profile-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 50%;
    background: var(--bg-secondary);
    color: var(--text-primary);
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .header-profile-btn:hover {
    background: var(--gray-200);
    border-color: var(--gray-300);
  }

  .header-profile-icon {
    display: block;
    width: 20px;
    height: 20px;
  }

  .header-profile-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.5rem;
    min-width: 200px;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 10px 32px rgba(0, 0, 0, 0.12);
    padding: 0.5rem 0;
    z-index: 100;
  }

  .header-profile-item {
    display: block;
    width: 100%;
    padding: 0.5rem 1rem;
    text-align: left;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-primary);
    text-decoration: none;
    background: none;
    border: none;
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.15s ease;
  }

  .header-profile-item:hover {
    background: var(--bg-secondary);
  }

  .header-profile-signout {
    color: var(--red-600, #dc2626);
    border-top: 1px solid var(--border);
    margin-top: 0.25rem;
    padding-top: 0.5rem;
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

  .notifications-stack {
    position: fixed;
    top: 4rem;
    right: 1rem;
    left: auto;
    z-index: 1100;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 360px;
    pointer-events: none;
  }

  .notifications-stack .notification-toast {
    pointer-events: auto;
  }

  .notification-toast {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    font-size: 0.9375rem;
    animation: toastIn 0.3s var(--ease-out-expo);
  }

  .notification-toast.notification-welcome {
    background: var(--navy-800);
    color: var(--white);
    border: 1px solid var(--navy-700);
  }

  .notification-toast.notification-info {
    background: var(--green-100);
    color: var(--green-800);
    border: 1px solid var(--green-300);
  }

  .notification-toast.notification-warning {
    background: var(--gray-100);
    color: var(--gray-800);
    border: 1px solid var(--border);
  }

  .notification-message {
    flex: 1;
    min-width: 0;
  }

  .notification-dismiss {
    flex-shrink: 0;
    background: none;
    border: none;
    font-size: 1.25rem;
    line-height: 1;
    cursor: pointer;
    opacity: 0.8;
    padding: 0.25rem;
    font-family: inherit;
    color: inherit;
  }

  .notification-dismiss:hover {
    opacity: 1;
  }

  @keyframes toastIn {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @media (max-width: 768px) {
    .notifications-stack {
      left: 1rem;
      right: 1rem;
      max-width: none;
      top: 3.5rem;
    }

    .header {
      padding: 0.875rem 1rem;
    }

    .header-title {
      font-size: 1.125rem;
    }

    .sidebar {
      width: 72px;
      padding: 0.5rem 0;
      align-items: center;
    }

    .sidebar-brand-text {
      display: none;
    }

    .sidebar-brand {
      padding: 0.5rem;
      justify-content: center;
      margin-bottom: 0.5rem;
    }

    .sidebar-item {
      padding: 0.5rem;
      justify-content: center;
      font-size: 0.8125rem;
    }

    .sidebar-label {
      display: none;
    }

    .sidebar-item-with-badge .sidebar-badge {
      right: 0.35rem;
      top: 0.35rem;
    }

    .dashboard-hero {
      padding: 1.5rem 1rem;
      border-radius: 0 0 16px 16px;
    }

    .dashboard-hero-inner {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .dashboard-hero-icon {
      width: 48px;
      height: 48px;
    }

    .dashboard-hero-title {
      font-size: 1.25rem;
    }

    .dashboard-quick-actions {
      grid-template-columns: repeat(2, 1fr);
      padding: 0 1rem 1rem;
    }

    .quick-action-card {
      padding: 1rem;
    }

    .quick-action-icon {
      width: 40px;
      height: 40px;
    }

    .quick-action-desc {
      display: none;
    }

    .dashboard-rooms-section {
      padding: 0 1rem 1rem;
    }
  }
</style>
