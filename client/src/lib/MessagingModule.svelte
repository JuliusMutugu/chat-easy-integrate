<script>
  import { onMount, onDestroy } from "svelte";
  import { io } from "socket.io-client";
  import ChatRoom from "./ChatRoom.svelte";
  import RoomList from "./RoomList.svelte";
  import CreateRoom from "./CreateRoom.svelte";
  import Settings from "./Settings.svelte";
  import Integrations from "./Integrations.svelte";
  import { playOpen, getAvatar } from "./theme.js";

  export let config = {
    serverUrl: "http://localhost:3000",
    username: "User",
    theme: "modern",
  };
  export let inviteRoom = null;
  export let inviteToken = null;
  export let onClose = () => {};

  let socket = null;
  let currentView = "dashboard";
  let currentRoom = null;
  let rooms = [];
  let isConnected = false;
  let error = null;
  let pendingRequests = [];
  let notifications = [];
  let profileDropdownOpen = false;
  let showOnboardingModal = false;
  let hasRequestedJoinForInvite = false;
  let inviteStatusAccepted = false;
  let invitePollTimer = null;

  onMount(() => {
    connectToServer();
    if (inviteRoom) {
      currentView = "dashboard";
    }
    addNotification("welcome", `Welcome back, ${config.username}`, 30000);
    try {
      showOnboardingModal = localStorage.getItem("nego-onboarding-dismissed") !== "true";
    } catch (_) {
      showOnboardingModal = true;
    }
    if (inviteToken && config.username) pollInviteStatus();
  });

  function dismissOnboarding() {
    try {
      localStorage.setItem("nego-onboarding-dismissed", "true");
    } catch (_) {}
    showOnboardingModal = false;
    currentView = "integrations";
  }

  let dashboardLastUpdated = "just now";
  let contactsFilter = "open";
  let inboxCategory = "all";
  let inboxSort = "newest";
  let lifecycleCollapsed = false;
  let inboxSearch = "";

  $: inboxFilteredRooms = (() => {
    let list = rooms;
    const q = inboxSearch.trim().toLowerCase();
    if (q) list = list.filter((r) => (r.name && r.name.toLowerCase().includes(q)) || (r.description && r.description.toLowerCase().includes(q)) || (String(r.code || "").includes(q)));
    if (inboxCategory === "mine") list = list.filter((r) => r.createdByUsername === config.username);
    if (inboxCategory === "new-lead") list = list.filter((r) => pendingRequests.some((p) => p.roomId === r.id));
    if (inboxCategory === "hot-lead" || inboxCategory === "payment" || inboxCategory === "customer" || inboxCategory === "unassigned") list = [];
    if (inboxSort === "newest") list = [...list].sort((a, b) => (b.id || 0) - (a.id || 0));
    return list;
  })();

  function formatInboxDate(room) {
    return "—";
  }

  onDestroy(() => {
    if (invitePollTimer) clearInterval(invitePollTimer);
    if (socket) {
      socket.off("join-request");
      socket.off("join-approved");
      socket.off("join-declined");
      socket.disconnect();
    }
  });

  async function pollInviteStatus() {
    if (!inviteToken || !config.username || !config.serverUrl) return;
    try {
      const res = await fetch(
        `${config.serverUrl}/api/rooms/invite/${inviteToken}/status?username=${encodeURIComponent(config.username)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.accepted && data.room) {
        inviteStatusAccepted = true;
        if (invitePollTimer) {
          clearInterval(invitePollTimer);
          invitePollTimer = null;
        }
        currentRoom = {
          id: data.room.id,
          name: data.room.name,
          description: data.room.description,
          code: data.room.code,
          maxUsers: data.room.maxUsers,
          createdByUsername: data.room.createdByUsername,
          userCount: data.room.userCount,
          users: data.room.users || [],
        };
        currentView = "rooms";
        addNotification("info", "You have been accepted into the room.", 5000);
      }
    } catch (_) {}
  }

  function startInvitePolling() {
    if (invitePollTimer) return;
    invitePollTimer = setInterval(pollInviteStatus, 4000);
    pollInviteStatus();
  }

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
      inviteStatusAccepted = true;
      if (invitePollTimer) {
        clearInterval(invitePollTimer);
        invitePollTimer = null;
      }
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
      currentView = "rooms";
      pendingRequests = pendingRequests.filter((p) => p.roomId !== data.roomId);
      addNotification("info", "You have been accepted into the room.", 5000);
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
    currentView = "rooms";
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
    if (hasRequestedJoinForInvite) return;
    hasRequestedJoinForInvite = true;
    socket.emit("request-join-room", {
      inviteToken: inviteTokenParam,
      username: config.username,
    });
    addNotification("info", "Request sent. Waiting for room creator to approve.", 8000);
    startInvitePolling();
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
      {#if currentRoom && (currentView === "chat" || currentView === "rooms")}
        <span class="header-room-context">
          <span class="header-room-name">{currentRoom.name}</span>
          <span class="header-room-sub">Room</span>
        </span>
      {:else if currentView === "dashboard"}
        <span>Dashboard</span>
      {:else if currentView === "rooms"}
        <span>Inbox</span>
      {:else if currentView === "contacts"}
        <span>Contacts</span>
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
          {#if getAvatar() === "male"}
            <span class="header-profile-icon header-profile-avatar" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/></svg>
            </span>
          {:else if getAvatar() === "female"}
            <span class="header-profile-icon header-profile-avatar" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="3"/><path d="M12 14c-4 0-6 2-6 4v2h12v-2c0-2-2-4-6-4z"/></svg>
            </span>
          {:else}
            <span class="header-profile-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="10" r="3"/><path d="M6.168 18.849A4 4 0 0 1 10 16h4a4 4 0 0 1 3.834 2.855"/></svg>
            </span>
          {/if}
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

  {#if showOnboardingModal}
    <div class="onboarding-backdrop" role="dialog" aria-labelledby="onboarding-title" aria-modal="true" tabindex="-1" onclick={(e) => e.target === e.currentTarget && dismissOnboarding()} onkeydown={(e) => e.key === "Escape" && dismissOnboarding()}>
      <div class="onboarding-modal">
        <div class="onboarding-modal-header">
          <span class="onboarding-modal-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </span>
          <h2 id="onboarding-title" class="onboarding-modal-title">Let's set up</h2>
        </div>
        <p class="onboarding-modal-text">Head to Settings to connect your communication channels and centralize all conversation in one place.</p>
        <div class="onboarding-modal-footer">
          <span class="onboarding-modal-progress">1/19</span>
          <button type="button" class="onboarding-modal-next" onclick={dismissOnboarding}>Next</button>
        </div>
      </div>
    </div>
  {/if}

  <div class="layout">
    <nav class="sidebar sidebar-respondio" aria-label="Nego navigation">
      <div class="sidebar-logo" title="Nego">
        <img src="/images/logo.jpg" alt="Nego" class="sidebar-logo-img" />
      </div>
      <ul class="sidebar-list">
        <li>
          <button type="button" class="sidebar-item sidebar-item-with-badge" class:active={currentView === "dashboard"} onclick={() => (currentView = "dashboard")} aria-current={currentView === "dashboard" ? "page" : undefined} title="Dashboard" aria-label={rooms.length ? "Dashboard (" + rooms.length + ")" : "Dashboard"}>
            <span class="sidebar-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
            </span>
            <span class="sidebar-label">Dashboard</span>
            {#if rooms.length > 0}
              <span class="sidebar-badge" aria-hidden="true">{rooms.length > 99 ? "99+" : rooms.length}</span>
            {/if}
          </button>
        </li>
        <li>
          <button type="button" class="sidebar-item sidebar-item-with-badge" class:active={currentView === "integrations"} onclick={() => (currentView = "integrations")} aria-current={currentView === "integrations" ? "page" : undefined} title="Channels" aria-label="Channels">
            <span class="sidebar-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </span>
            <span class="sidebar-label">Channels</span>
            <span class="sidebar-badge sidebar-badge-integrations" aria-hidden="true">0</span>
          </button>
        </li>
        <li>
          <button type="button" class="sidebar-item" class:active={currentView === "contacts"} onclick={() => (currentView = "contacts")} aria-current={currentView === "contacts" ? "page" : undefined} title="Contacts">
            <span class="sidebar-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </span>
            <span class="sidebar-label">Contacts</span>
          </button>
        </li>
        <li>
          <button type="button" class="sidebar-item sidebar-item-with-badge" class:active={currentView === "rooms"} onclick={() => (currentView = "rooms")} aria-current={currentView === "rooms" ? "page" : undefined} title="Inbox" aria-label={rooms.length ? "Inbox (" + rooms.length + ")" : "Inbox"}>
            <span class="sidebar-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </span>
            <span class="sidebar-label">Inbox</span>
            {#if rooms.length > 0}
              <span class="sidebar-badge" aria-hidden="true">{rooms.length > 99 ? "99+" : rooms.length}</span>
            {/if}
          </button>
        </li>
        <li>
          <button type="button" class="sidebar-item sidebar-item-with-badge" class:active={currentView === "pending"} onclick={handleOpenPending} aria-current={currentView === "pending" ? "page" : undefined} title="Notifications" aria-label={pendingRequests.length ? "Pending (" + pendingRequests.length + ")" : "Pending"}>
            <span class="sidebar-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </span>
            <span class="sidebar-label">Notifications</span>
            {#if pendingRequests.length > 0}
              <span class="sidebar-badge" aria-hidden="true">{pendingRequests.length}</span>
            {/if}
          </button>
        </li>
        <li>
          <button type="button" class="sidebar-item" class:active={currentView === "settings"} onclick={() => (currentView = "settings")} aria-current={currentView === "settings" ? "page" : undefined} title="Settings">
            <span class="sidebar-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </span>
            <span class="sidebar-label">Settings</span>
          </button>
        </li>
        {#if currentRoom && (currentView === "chat" || currentView === "rooms")}
          <li>
            <button type="button" class="sidebar-item sidebar-item-chat" onclick={handleLeaveRoom} aria-label="Close conversation">
              <span class="sidebar-icon" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </span>
              <span class="sidebar-label">Close</span>
            </button>
          </li>
        {/if}
      </ul>
      <div class="sidebar-footer">
        <button type="button" class="sidebar-profile" onclick={() => { profileDropdownOpen = !profileDropdownOpen; }} title="{config.username}" aria-label="Profile">
          <span class="sidebar-profile-avatar">{config.username ? config.username.charAt(0).toUpperCase() : "?"}</span>
          <span class="sidebar-profile-dot" class:online={isConnected} aria-hidden="true"></span>
        </button>
      </div>
    </nav>

    <div class="body">
      {#key currentView}
        {#if currentView === "dashboard"}
          <div class="view-wrap view-dashboard respondio-dashboard">
            <header class="dashboard-header">
              <h1 class="dashboard-page-title">Dashboard</h1>
              <div class="dashboard-header-meta">
                <span class="dashboard-updated">Last updated {dashboardLastUpdated}</span>
                <span class="dashboard-timezone">Africa/Nairobi (GMT+03:00)</span>
                <button type="button" class="dashboard-refresh" onclick={() => { loadRooms(); loadPendingRequests(); dashboardLastUpdated = 'just now'; }}>Refresh</button>
              </div>
            </header>
            <div class="dashboard-main">
              <section class="dashboard-card channels-card">
                <div class="channels-card-inner">
                  <div class="channels-card-content">
                    <span class="channels-card-icon" aria-hidden="true">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    </span>
                    <h2 class="channels-card-title">You have no channels connected</h2>
                    <p class="channels-card-desc">You can connect all your business messaging accounts in one place. We call these accounts channels. Let's connect a channel.</p>
                    <button type="button" class="channels-card-cta" onclick={() => (currentView = 'integrations')}>Connect Channel</button>
                  </div>
                </div>
              </section>
              <section class="dashboard-lifecycle" aria-labelledby="lifecycle-heading">
                <h2 id="lifecycle-heading" class="dashboard-section-heading">Lifecycle</h2>
                <div class="lifecycle-grid">
                  <div class="lifecycle-card">
                    <span class="lifecycle-icon lifecycle-new" aria-hidden="true">New Lead</span>
                    <span class="lifecycle-count">{pendingRequests.length}</span>
                    <span class="lifecycle-pct">0.00%</span>
                  </div>
                  <div class="lifecycle-card">
                    <span class="lifecycle-icon lifecycle-hot" aria-hidden="true">Hot Lead</span>
                    <span class="lifecycle-count">0</span>
                    <span class="lifecycle-pct">0.00%</span>
                  </div>
                  <div class="lifecycle-card">
                    <span class="lifecycle-icon lifecycle-payment" aria-hidden="true">Payment</span>
                    <span class="lifecycle-count">0</span>
                    <span class="lifecycle-pct">0.00%</span>
                  </div>
                  <div class="lifecycle-card">
                    <span class="lifecycle-icon lifecycle-customer" aria-hidden="true">Customer</span>
                    <span class="lifecycle-count">0</span>
                    <span class="lifecycle-pct">0.00%</span>
                  </div>
                </div>
              </section>
              <section class="dashboard-contacts" aria-labelledby="contacts-heading">
                <h2 id="contacts-heading" class="dashboard-section-heading">Contacts</h2>
                <div class="contacts-tabs">
                  <button type="button" class="contacts-tab" class:active={contactsFilter === "open"} onclick={() => (contactsFilter = "open")}>Open</button>
                  <button type="button" class="contacts-tab" class:active={contactsFilter === "assigned"} onclick={() => (contactsFilter = "assigned")}>Assigned</button>
                  <button type="button" class="contacts-tab" class:active={contactsFilter === "unassigned"} onclick={() => (contactsFilter = "unassigned")}>Unassigned</button>
                </div>
                <div class="contacts-empty">
                  <p>No contacts yet. Conversations will appear here.</p>
                </div>
              </section>
              <section class="dashboard-team" aria-labelledby="team-heading">
                <h2 id="team-heading" class="dashboard-section-heading">Team Members</h2>
                <div class="team-status-row">
                  <select class="team-status-select" aria-label="Filter by status"><option>All Statuses</option></select>
                </div>
                <ul class="team-list">
                  <li class="team-member">
                    <div class="team-member-avatar-wrap">
                      <span class="team-member-avatar">{config.username ? config.username.charAt(0).toUpperCase() : "?"}</span>
                      <span class="team-member-dot" class:online={isConnected} aria-hidden="true"></span>
                    </div>
                    <div class="team-member-info">
                      <span class="team-member-name">{config.username}</span>
                      <span class="team-member-meta">Assigned to 0 contacts · Since {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </li>
                </ul>
              </section>
            </div>
          </div>
        {:else if currentView === "rooms"}
          <div class="view-wrap view-rooms view-inbox-twopane">
            <aside class="inbox-pane inbox-pane-list" aria-label="Conversations">
              <div class="inbox-list-header respondio-inbox-header">
                <h2 id="inbox-all-heading" class="inbox-all-title">All <span class="inbox-all-count">({rooms.length})</span></h2>
                <div class="inbox-filters">
                  <button type="button" class="inbox-filter-btn" class:active={inboxSort === "newest"} onclick={() => (inboxSort = "newest")}>All, Newest</button>
                  <button type="button" class="inbox-filter-btn" class:active={inboxSort === "unreplied"} onclick={() => (inboxSort = "unreplied")}>Unreplied</button>
                </div>
              </div>
              <div class="inbox-categories" aria-label="Inbox categories">
                <button type="button" class="inbox-cat-item" class:active={inboxCategory === "all"} onclick={() => (inboxCategory = "all")}>
                  <span class="inbox-cat-name">All</span>
                  <span class="inbox-cat-count">{rooms.length}</span>
                </button>
                <button type="button" class="inbox-cat-item" class:active={inboxCategory === "mine"} onclick={() => (inboxCategory = "mine")}>
                  <span class="inbox-cat-name">Mine</span>
                  <span class="inbox-cat-count">{rooms.filter((r) => r.createdByUsername === config.username).length}</span>
                </button>
                <button type="button" class="inbox-cat-item" class:active={inboxCategory === "unassigned"} onclick={() => (inboxCategory = "unassigned")}>
                  <span class="inbox-cat-name">Unassigned</span>
                  <span class="inbox-cat-count">0</span>
                </button>
                <button type="button" class="inbox-cat-item" aria-expanded={!lifecycleCollapsed} onclick={() => (lifecycleCollapsed = !lifecycleCollapsed)}>
                  <span class="inbox-cat-name">Lifecycle</span>
                  <span class="inbox-cat-chevron" aria-hidden="true">{lifecycleCollapsed ? "▶" : "▼"}</span>
                </button>
                {#if !lifecycleCollapsed}
                  <div class="inbox-cat-children">
                    <button type="button" class="inbox-cat-item inbox-cat-child" class:active={inboxCategory === "new-lead"} onclick={() => (inboxCategory = "new-lead")}>
                      <span class="inbox-cat-name">New Lead</span>
                      <span class="inbox-cat-count">{pendingRequests.length}</span>
                    </button>
                    <button type="button" class="inbox-cat-item inbox-cat-child" class:active={inboxCategory === "hot-lead"} onclick={() => (inboxCategory = "hot-lead")}>
                      <span class="inbox-cat-name">Hot Lead</span>
                      <span class="inbox-cat-count">0</span>
                    </button>
                    <button type="button" class="inbox-cat-item inbox-cat-child" class:active={inboxCategory === "payment"} onclick={() => (inboxCategory = "payment")}>
                      <span class="inbox-cat-name">Payment</span>
                      <span class="inbox-cat-count">0</span>
                    </button>
                    <button type="button" class="inbox-cat-item inbox-cat-child" class:active={inboxCategory === "customer"} onclick={() => (inboxCategory = "customer")}>
                      <span class="inbox-cat-name">Customer</span>
                      <span class="inbox-cat-count">0</span>
                    </button>
                  </div>
                {/if}
                <div class="inbox-cat-divider"></div>
                <button type="button" class="inbox-cat-item" onclick={() => (inboxCategory = "all")}>
                  <span class="inbox-cat-name">Custom Inbox</span>
                </button>
                <button type="button" class="inbox-cat-item">
                  <span class="inbox-cat-name">Campaigns</span>
                </button>
                <button type="button" class="inbox-cat-item">
                  <span class="inbox-cat-name">VIP Clients</span>
                </button>
              </div>
              <div class="inbox-conversations-header">
                <span class="inbox-conv-tabs">Chats</span>
                <input type="search" class="inbox-search" placeholder="Search..." bind:value={inboxSearch} aria-label="Search conversations" />
              </div>
              <div class="inbox-list-body">
                {#if inviteRoom && inviteToken && !inviteStatusAccepted && (!currentRoom || currentRoom.id !== inviteRoom.id)}
                  <div class="inbox-invite-banner">
                    <p class="inbox-invite-text">You're invited to <strong>{inviteRoom.name}</strong></p>
                    {#if hasRequestedJoinForInvite}
                      <p class="inbox-invite-waiting">Request sent. Waiting for room creator to approve.</p>
                      <button type="button" class="btn-inbox-request btn-inbox-request-disabled" disabled>Request to join</button>
                    {:else}
                      <button type="button" class="btn-inbox-request" onclick={() => handleRequestJoin(inviteToken)}>Request to join</button>
                    {/if}
                  </div>
                {:else if inviteRoom && inviteToken && (inviteStatusAccepted || (currentRoom && currentRoom.id === inviteRoom.id))}
                  <div class="inbox-invite-banner inbox-invite-accepted">
                    <p class="inbox-invite-text">You're in <strong>{inviteRoom.name}</strong></p>
                  </div>
                {/if}
                {#if inboxFilteredRooms.length === 0}
                  <div class="inbox-empty-rows">
                    <p>No conversations yet.</p>
                    <button type="button" class="btn-inbox-create-room" onclick={handleCreateRoom}>Create room</button>
                  </div>
                {:else}
                  <ul class="inbox-conversation-list" role="list">
                    {#each inboxFilteredRooms as room (room.id)}
                      {@const hasPending = pendingRequests.some((p) => p.roomId === room.id)}
                      <li class="inbox-conv-li">
                        <button type="button" class="inbox-conv-row" class:selected={currentRoom && currentRoom.id === room.id} onclick={() => handleJoinRoom(room)}>
                          <span class="inbox-conv-avatar" aria-hidden="true">{room.name ? room.name.charAt(0).toUpperCase() : "?"}</span>
                          <div class="inbox-conv-main">
                            <div class="inbox-conv-top">
                              <span class="inbox-conv-name">{room.name}</span>
                              <span class="inbox-conv-date">{formatInboxDate(room)}</span>
                            </div>
                            <p class="inbox-conv-snippet">{room.description || "No messages yet"}</p>
                            {#if hasPending}<span class="inbox-conv-tag">New Lead</span>{/if}
                          </div>
                          <span class="inbox-conv-channel" aria-hidden="true">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                          </span>
                        </button>
                      </li>
                    {/each}
                  </ul>
                {/if}
              </div>
              <div class="inbox-list-footer">
                <button type="button" class="btn-inbox-create" onclick={handleCreateRoom}>Create room</button>
                <button type="button" class="btn-inbox-pending" onclick={handleOpenPending} aria-label="Pending requests" title="Pending">
                  {#if pendingRequests.length > 0}<span class="inbox-pending-badge">{pendingRequests.length}</span>{/if}
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                </button>
              </div>
            </aside>
            <main class="inbox-pane inbox-pane-chat" aria-label="Conversation">
              {#if currentRoom}
                <div class="view-chat">
                  <ChatRoom
                    key={currentRoom.id}
                    {socket}
                    {config}
                    room={currentRoom}
                    onLeaveRoom={handleLeaveRoom}
                  />
                </div>
              {:else}
                <div class="inbox-empty-state">
                  <div class="inbox-empty-icon" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  </div>
                  <h3 class="inbox-empty-title">Select a conversation</h3>
                  <p class="inbox-empty-desc">Choose a room from the list to start messaging, or create a new room.</p>
                  <button type="button" class="btn-inbox-empty-create" onclick={handleCreateRoom}>Create room</button>
                </div>
              {/if}
            </main>
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
        {:else if currentView === "contacts"}
          <div class="view-wrap view-contacts">
            <header class="contacts-page-header">
              <h1 class="contacts-page-title">Contacts</h1>
              <button type="button" class="btn-back-contacts" onclick={() => (currentView = "dashboard")}>Back</button>
            </header>
            <div class="contacts-page-empty">
              <p>Contacts from your conversations will appear here. Connect channels and start conversations to see contacts.</p>
            </div>
          </div>
        {:else if currentView === "integrations"}
          <div class="view-wrap view-integrations">
            <Integrations {config} onBack={handleBackToRooms} />
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

  .onboarding-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .onboarding-modal {
    background: var(--card-bg);
    border-radius: 16px;
    padding: 1.5rem 1.75rem;
    max-width: 420px;
    width: 100%;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
    border: 1px solid var(--border);
  }

  .onboarding-modal-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .onboarding-modal-icon {
    color: var(--navy-700);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .onboarding-modal-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--navy-900);
  }

  .onboarding-modal-text {
    margin: 0 0 1.5rem;
    font-size: 0.9375rem;
    color: var(--gray-600);
    line-height: 1.5;
  }

  .onboarding-modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .onboarding-modal-progress {
    font-size: 0.8125rem;
    color: var(--gray-500);
    font-weight: 500;
  }

  .onboarding-modal-next {
    padding: 0.625rem 1.25rem;
    border-radius: 8px;
    border: none;
    background: var(--navy-900);
    color: var(--white);
    font-size: 0.9375rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .onboarding-modal-next:hover {
    background: var(--navy-800);
  }

  .sidebar {
    width: 240px;
    flex-shrink: 0;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    padding: 0.5rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    transition: background-color var(--duration-normal) var(--ease-in-out),
      border-color var(--duration-normal) var(--ease-in-out);
  }

  .sidebar-respondio {
    width: 200px;
    padding: 0.75rem 0.5rem;
    align-items: stretch;
    background: var(--sidebar-bg, var(--navy-900));
    border-right-color: var(--sidebar-border, var(--navy-800));
    transition: background-color var(--duration-normal) var(--ease-in-out),
      border-color var(--duration-normal) var(--ease-in-out),
      color var(--duration-normal) var(--ease-in-out);
  }

  :global([data-theme="light"]) .sidebar-respondio {
    --sidebar-bg: var(--gray-100);
    --sidebar-border: var(--gray-200);
    --sidebar-text: var(--gray-700);
    --sidebar-text-hover: var(--gray-900);
    --sidebar-icon: var(--gray-600);
    --sidebar-icon-hover: var(--gray-900);
    --sidebar-active-bg: var(--green-600);
    --sidebar-active-text: var(--white);
    --sidebar-logo-bg: var(--gray-200);
    --sidebar-footer-border: var(--gray-200);
    --sidebar-profile-bg: var(--gray-200);
    --sidebar-profile-text: var(--gray-800);
  }

  :global([data-theme="dark"]) .sidebar-respondio,
  .sidebar-respondio {
    --sidebar-bg: var(--navy-900);
    --sidebar-border: var(--navy-800);
    --sidebar-text: var(--gray-400);
    --sidebar-text-hover: var(--white);
    --sidebar-icon: var(--gray-400);
    --sidebar-icon-hover: var(--white);
    --sidebar-active-bg: var(--green-600);
    --sidebar-active-text: var(--white);
    --sidebar-logo-bg: var(--navy-800);
    --sidebar-footer-border: var(--navy-800);
    --sidebar-profile-bg: var(--navy-800);
    --sidebar-profile-text: var(--white);
  }

  .sidebar-respondio .sidebar-list {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 0.25rem;
  }

  .sidebar-respondio .sidebar-item {
    width: 100%;
    min-height: 44px;
    padding: 0.5rem 0.75rem;
    justify-content: flex-start;
    gap: 0.75rem;
    border-radius: 10px;
    color: var(--sidebar-text);
  }

  .sidebar-respondio .sidebar-item:hover {
    background: var(--sidebar-border);
    color: var(--sidebar-text-hover);
  }

  .sidebar-respondio .sidebar-item .sidebar-icon {
    color: var(--sidebar-icon);
    flex-shrink: 0;
  }

  .sidebar-respondio .sidebar-item:hover .sidebar-icon {
    color: var(--sidebar-icon-hover);
  }

  .sidebar-respondio .sidebar-item.active {
    background: var(--sidebar-active-bg);
    color: var(--sidebar-active-text);
    border-right: none;
  }

  .sidebar-respondio .sidebar-item.active .sidebar-icon {
    color: var(--sidebar-active-text);
  }

  .sidebar-respondio .sidebar-label {
    display: inline;
    font-size: 0.875rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sidebar-respondio .sidebar-item-with-badge {
    position: relative;
    padding: 0;
  }

  .sidebar-respondio .sidebar-badge {
    top: 4px;
    right: 4px;
    left: auto;
    min-width: 18px;
    height: 18px;
    font-size: 0.625rem;
  }

  .sidebar-respondio .sidebar-logo {
    background: var(--sidebar-logo-bg);
  }

  .sidebar-logo {
    width: 48px;
    height: 48px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.75rem;
    border-radius: 12px;
    overflow: hidden;
    background: var(--navy-800);
  }

  .sidebar-logo-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .sidebar-respondio .sidebar-footer {
    border-top-color: var(--sidebar-footer-border);
  }

  .sidebar-footer {
    margin-top: auto;
    padding-top: 0.75rem;
    border-top: 1px solid var(--navy-800);
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .sidebar-respondio .sidebar-profile {
    background: var(--sidebar-profile-bg);
    color: var(--sidebar-profile-text);
  }

  .sidebar-profile {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: none;
    background: var(--navy-800);
    color: var(--white);
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
    transition: background 0.15s ease;
  }

  .sidebar-profile:hover {
    background: var(--navy-700);
  }

  .sidebar-profile-dot {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--gray-500);
    border: 2px solid var(--navy-900);
  }

  .sidebar-profile-dot.online {
    background: var(--green-500);
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

  /* Respond.io-style Dashboard */
  .view-dashboard {
    overflow-y: auto;
    padding: 1.5rem;
    padding-bottom: 2rem;
    background: var(--bg-primary);
  }

  .dashboard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .dashboard-page-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  .dashboard-header-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .dashboard-refresh {
    padding: 0.375rem 0.75rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .dashboard-refresh:hover {
    background: var(--gray-200);
  }

  .dashboard-main {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-width: 960px;
  }

  .dashboard-card.channels-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 1.5rem 2rem;
    transition: background-color var(--duration-normal), border-color var(--duration-normal);
  }

  .channels-card-inner {
    display: flex;
    align-items: flex-start;
    gap: 1.5rem;
  }

  .channels-card-content {
    flex: 1;
    min-width: 0;
  }

  .channels-card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background: var(--green-100);
    color: var(--green-600);
    flex-shrink: 0;
  }

  .channels-card-title {
    margin: 0 0 0.5rem;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .channels-card-desc {
    margin: 0 0 1rem;
    font-size: 0.9375rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .channels-card-cta {
    padding: 0.5rem 1.25rem;
    border-radius: 10px;
    border: none;
    background: var(--green-600);
    color: var(--white);
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s ease;
  }

  .channels-card-cta:hover {
    background: var(--green-700);
  }

  .dashboard-section-heading {
    margin: 0 0 0.75rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .lifecycle-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
  }

  .lifecycle-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    text-align: center;
  }

  .lifecycle-icon {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--text-secondary);
  }

  .lifecycle-count {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .lifecycle-pct {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .contacts-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .contacts-tab {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .contacts-tab:hover {
    background: var(--gray-200);
    color: var(--text-primary);
  }

  .contacts-tab.active {
    background: var(--green-600);
    border-color: var(--green-600);
    color: var(--white);
  }

  .contacts-empty {
    padding: 2rem;
    text-align: center;
    font-size: 0.9375rem;
    color: var(--text-secondary);
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
  }

  .team-status-row {
    margin-bottom: 0.75rem;
  }

  .team-status-select {
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.875rem;
    font-family: inherit;
  }

  .team-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .team-member {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
  }

  .team-member-avatar-wrap {
    position: relative;
    flex-shrink: 0;
  }

  .team-member-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: var(--green-600);
    color: var(--white);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1rem;
  }

  .team-member-dot {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--gray-500);
    border: 2px solid var(--card-bg);
  }

  .team-member-dot.online {
    background: var(--green-500);
  }

  .team-member-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .team-member-name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.9375rem;
  }

  .team-member-meta {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .view-contacts {
    padding: 1.5rem;
    overflow-y: auto;
  }

  .contacts-page-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .contacts-page-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .btn-back-contacts {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .contacts-page-empty {
    padding: 3rem 2rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.9375rem;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
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

  /* Two-pane Inbox (respond.io style) */
  .view-inbox-twopane {
    flex-direction: row;
    min-width: 0;
  }

  .inbox-pane {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  .inbox-pane-list {
    width: 320px;
    max-width: 36%;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    background: var(--bg-secondary);
  }

  .inbox-pane-chat {
    flex: 1;
    min-width: 0;
    background: var(--bg-primary);
  }

  .inbox-list-header {
    flex-shrink: 0;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .inbox-list-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .inbox-list-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-inbox-create,
  .btn-inbox-pending {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.75rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--card-bg);
    color: var(--text-primary);
    font-size: 0.8125rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .btn-inbox-create:hover,
  .btn-inbox-pending:hover {
    background: var(--gray-100);
    border-color: var(--gray-300);
  }

  .btn-inbox-pending {
    position: relative;
  }

  .inbox-pending-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 0.35rem;
    border-radius: 999px;
    background: var(--green-600);
    color: var(--white);
    font-size: 0.6875rem;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .inbox-list-body {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .inbox-empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    text-align: center;
  }

  .inbox-empty-icon {
    color: var(--gray-400);
    margin-bottom: 1rem;
  }

  .inbox-empty-title {
    margin: 0 0 0.5rem;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .inbox-empty-desc {
    margin: 0 0 1.25rem;
    font-size: 0.9375rem;
    color: var(--text-secondary);
    max-width: 280px;
    line-height: 1.5;
  }

  .btn-inbox-empty-create {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: none;
    background: var(--green-600);
    color: var(--white);
    font-size: 0.875rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .btn-inbox-empty-create:hover {
    background: var(--green-700);
  }

  .view-inbox-twopane .view-chat {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .respondio-inbox-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }

  .inbox-all-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .inbox-all-count {
    font-weight: 500;
    color: var(--text-secondary);
  }

  .inbox-filters {
    display: flex;
    gap: 0.5rem;
  }

  .inbox-filter-btn {
    padding: 0.25rem 0.5rem;
    border: none;
    background: none;
    color: var(--text-secondary);
    font-size: 0.8125rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    border-radius: 6px;
  }

  .inbox-filter-btn:hover,
  .inbox-filter-btn.active {
    color: var(--text-primary);
    background: var(--gray-100);
  }

  .inbox-categories {
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .inbox-cat-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.4rem 0.5rem;
    border: none;
    background: none;
    color: var(--text-secondary);
    font-size: 0.8125rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    border-radius: 6px;
    text-align: left;
    width: 100%;
  }

  .inbox-cat-item:hover {
    background: var(--gray-100);
    color: var(--text-primary);
  }

  .inbox-cat-item.active {
    background: var(--navy-100);
    color: var(--navy-800);
  }

  .inbox-cat-name {
    flex: 1;
  }

  .inbox-cat-count {
    font-size: 0.75rem;
    color: var(--gray-500);
  }

  .inbox-cat-chevron {
    font-size: 0.625rem;
    margin-left: 0.25rem;
  }

  .inbox-cat-children {
    padding-left: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .inbox-cat-child {
    font-size: 0.75rem;
  }

  .inbox-cat-divider {
    height: 1px;
    background: var(--border);
    margin: 0.25rem 0;
  }

  .inbox-conversations-header {
    padding: 0.5rem 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 1px solid var(--border);
  }

  .inbox-conv-tabs {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .inbox-search {
    flex: 1;
    min-width: 0;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.75rem;
    font-family: inherit;
    background: var(--card-bg);
  }

  .inbox-search:focus {
    outline: none;
    border-color: var(--green-600);
  }

  .inbox-invite-banner {
    padding: 0.75rem 1rem;
    background: var(--green-50);
    border-bottom: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .inbox-invite-text {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--gray-700);
  }

  .btn-inbox-request {
    padding: 0.35rem 0.75rem;
    border-radius: 6px;
    border: none;
    background: var(--green-600);
    color: var(--white);
    font-size: 0.8125rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }

  .btn-inbox-request:hover {
    background: var(--green-700);
  }

  .btn-inbox-request-disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .inbox-invite-waiting {
    margin: 0 0 0.5rem;
    font-size: 0.75rem;
    color: var(--gray-600);
  }

  .inbox-invite-accepted {
    background: var(--green-100);
  }

  .inbox-invite-accepted .inbox-invite-text {
    color: var(--green-800);
  }

  .inbox-empty-rows {
    padding: 1.5rem 1rem;
    text-align: center;
  }

  .inbox-empty-rows p {
    margin: 0 0 0.75rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .btn-inbox-create-room {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: none;
    background: var(--green-600);
    color: var(--white);
    font-size: 0.8125rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
  }

  .btn-inbox-create-room:hover {
    background: var(--green-700);
  }

  .inbox-conversation-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .inbox-conv-li {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .inbox-conv-row {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border: none;
    background: none;
    cursor: pointer;
    width: 100%;
    text-align: left;
    font-family: inherit;
    border-bottom: 1px solid var(--border);
    transition: background-color 0.15s ease;
    border-radius: 0;
    color: inherit;
  }

  .inbox-conv-row:hover {
    background: var(--gray-50);
  }

  .inbox-conv-row.selected {
    background: var(--navy-50);
    border-left: 3px solid var(--green-600);
  }

  .inbox-conv-avatar {
    width: 40px;
    height: 40px;
    min-width: 40px;
    border-radius: 50%;
    background: var(--navy-200);
    color: var(--navy-800);
    font-weight: 700;
    font-size: 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .inbox-conv-main {
    flex: 1;
    min-width: 0;
  }

  .inbox-conv-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .inbox-conv-name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .inbox-conv-date {
    font-size: 0.6875rem;
    color: var(--gray-500);
    flex-shrink: 0;
  }

  .inbox-conv-snippet {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--text-secondary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .inbox-conv-tag {
    display: inline-block;
    margin-top: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--green-700);
    background: var(--green-100);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
  }

  .inbox-conv-channel {
    color: var(--gray-400);
    flex-shrink: 0;
    margin-top: 0.25rem;
  }

  .inbox-list-footer {
    flex-shrink: 0;
    padding: 0.5rem 1rem;
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 0.5rem;
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
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25);
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
