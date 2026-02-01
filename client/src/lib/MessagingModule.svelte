<script>
  import { onMount, onDestroy } from "svelte";
  import { io } from "socket.io-client";
  import ChatRoom from "./ChatRoom.svelte";
  import RoomList from "./RoomList.svelte";
  import CreateRoom from "./CreateRoom.svelte";
  import Settings from "./Settings.svelte";
  import Integrations from "./Integrations.svelte";
  import { playOpen, getAvatar, getWorkflowConfig, setWorkflowConfig, getAssignedAgentTemplate, getAssignedToDisplay } from "./theme.js";

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
  let messageDraft = "";
  let sendMessageRef = null;

  onMount(() => {
    connectToServer();
    applyPath(typeof window !== "undefined" ? window.location.pathname : "/dashboard");
    // If user came with an invite, go to inbox so they can request access
    if (inviteRoom && inviteToken) {
      currentView = "rooms";
      inboxPage = "all";
    }
    window.addEventListener("popstate", onPopState);
    addNotification("welcome", `Welcome back, ${config.username}`, 30000);
    try {
      showOnboardingModal = localStorage.getItem("nego-onboarding-dismissed") !== "true";
    } catch (_) {
      showOnboardingModal = true;
    }
    if (inviteToken && config.username && !inviteStatusAccepted) startInvitePolling();
    return () => window.removeEventListener("popstate", onPopState);
  });

  function dismissOnboarding() {
    try {
      localStorage.setItem("nego-onboarding-dismissed", "true");
    } catch (_) {}
    showOnboardingModal = false;
    goTo("integrations");
  }

  let dashboardLastUpdated = "just now";
  let contactsFilter = "open";
  /** Inbox page: chats views (all, mine, unassigned, new-lead, hot-lead, payment, customer, team) or config pages (incoming-calls, ai-agents, campaigns, vip-clients) */
  let inboxPage = "all";
  let inboxSort = "newest";
  let inboxSearch = "";
  let contextBarExpanded = false;
  let inboxTeamFilter = "";
  /** Whether Lifecycle sub-nav is open in the top tab bar */
  let lifecycleNavOpen = false;
  let teamsNavOpen = false;
  let contextAssignedTo = "";
  let contextLifecycle = "";
  let contextTeamName = "";
  /** Full-screen "Train your agent" view: template being edited */
  let workflowTrainTemplate = null;
  let workflowTrainProduct = "";
  let workflowTrainKpis = "";
  let workflowTrainInstructions = "";
  let workflowTrainWebsiteText = "";
  let workflowTrainDocumentText = "";
  let workflowTrainUrlInput = "";
  let workflowTrainUrlLoading = false;
  let workflowTrainUploadLoading = false;
  let aiReplyLoading = false;

  /** Build path from current view state (no leading slash for relative, we'll use with base) */
  function getPathFromState() {
    if (currentView === "dashboard") return "/dashboard";
    if (currentView === "workflows") return "/workflows";
    if (currentView === "workflow-train" && workflowTrainTemplate) return "/workflows/train/" + workflowTrainTemplate;
    if (currentView === "rooms") {
      if (inboxPage === "all") return "/inbox";
      if (inboxPage === "team" && inboxTeamFilter) return "/inbox/team/" + encodeURIComponent(inboxTeamFilter);
      return "/inbox/" + inboxPage;
    }
    if (currentView === "contacts") return "/contacts";
    if (currentView === "settings") return "/settings";
    if (currentView === "integrations") return "/integrations";
    if (currentView === "create") return "/create";
    if (currentView === "pending") return "/pending";
    return "/dashboard";
  }

  /** Parse path and set currentView, inboxPage, inboxTeamFilter, currentRoom */
  function applyPath(path) {
    const p = (path || "").replace(/^\/+/, "") || "dashboard";
    if (p === "dashboard") {
      currentView = "dashboard";
      return;
    }
    if (p === "workflows") {
      currentView = "workflows";
      workflowTrainTemplate = null;
      return;
    }
    if (p.startsWith("workflows/train/")) {
      const template = p.slice("workflows/train/".length).replace(/\/$/, "");
      if (["sales-engineer", "marketing-engineer", "receptionist"].includes(template)) {
        currentView = "workflow-train";
        workflowTrainTemplate = template;
        loadWorkflowTrainData();
      } else {
        currentView = "workflows";
      }
      return;
    }
    if (p === "contacts") {
      currentView = "contacts";
      return;
    }
    if (p === "settings") {
      currentView = "settings";
      return;
    }
    if (p === "integrations") {
      currentView = "integrations";
      return;
    }
    if (p === "create") {
      currentView = "create";
      return;
    }
    if (p === "pending") {
      currentView = "pending";
      return;
    }
    if (p === "inbox" || p === "inbox/all") {
      currentView = "rooms";
      inboxPage = "all";
      currentRoom = null;
      lifecycleNavOpen = false;
      teamsNavOpen = false;
      return;
    }
    if (p.startsWith("inbox/")) {
      const rest = p.slice(6);
      currentView = "rooms";
      currentRoom = null;
      lifecycleNavOpen = false;
      teamsNavOpen = false;
      if (rest === "mine") {
        inboxPage = "mine";
        return;
      }
      if (rest === "unassigned") {
        inboxPage = "unassigned";
        return;
      }
      if (rest === "incoming-calls") {
        inboxPage = "incoming-calls";
        return;
      }
      if (rest === "ai-agents") {
        inboxPage = "ai-agents";
        return;
      }
      if (rest === "new-lead") {
        inboxPage = "new-lead";
        return;
      }
      if (rest === "hot-lead") {
        inboxPage = "hot-lead";
        return;
      }
      if (rest === "payment") {
        inboxPage = "payment";
        return;
      }
      if (rest === "customer") {
        inboxPage = "customer";
        return;
      }
      if (rest.startsWith("team/")) {
        inboxPage = "team";
        inboxTeamFilter = decodeURIComponent(rest.slice(5).replace(/\/$/, ""));
        return;
      }
      if (rest === "campaigns") {
        inboxPage = "campaigns";
        return;
      }
      if (rest === "vip-clients") {
        inboxPage = "vip-clients";
        return;
      }
      inboxPage = "all";
      return;
    }
    currentView = "dashboard";
  }

  /** Navigate to a view and update URL */
  function goTo(view, opts = {}) {
    if (view === "dashboard") {
      currentView = "dashboard";
    } else if (view === "rooms") {
      currentView = "rooms";
      currentRoom = null;
      if (opts.inboxPage != null) inboxPage = opts.inboxPage;
      if (opts.inboxTeamFilter != null) inboxTeamFilter = opts.inboxTeamFilter;
      lifecycleNavOpen = false;
      teamsNavOpen = false;
    } else if (view === "workflow-train" && opts.template) {
      currentView = "workflow-train";
      workflowTrainTemplate = opts.template;
      loadWorkflowTrainData();
    } else if (view === "workflows" || view === "contacts" || view === "settings" || view === "integrations" || view === "create" || view === "pending") {
      currentView = view;
    }
    if (typeof window !== "undefined") window.history.pushState({}, document.title, getPathFromState());
  }

  function goToWorkflowTrain(template) {
    goTo("workflow-train", { template });
  }

  function onPopState() {
    if (typeof window === "undefined") return;
    applyPath(window.location.pathname);
  }

  $: if (currentRoom) {
    contextAssignedTo = currentRoom.assignedTo ?? "";
    contextLifecycle = currentRoom.lifecycleStage ?? "";
    contextTeamName = currentRoom.teamName ?? "";
  }

  function isMine(room) {
    return room.createdByUsername === config.username || room.assignedTo === config.username;
  }
  function isNewLead(room) {
    return room.lifecycleStage === "new_lead" || pendingRequests.some((p) => p.roomId === room.id);
  }

  /** True when current inbox page shows the chats list (left pane = Chats + list) */
  $: inboxShowsChatsList = ["all", "mine", "unassigned", "new-lead", "hot-lead", "payment", "customer", "team"].includes(inboxPage);

  $: inboxFilteredRooms = (() => {
    if (!inboxShowsChatsList) return [];
    let list = rooms;
    const q = inboxSearch.trim().toLowerCase();
    if (q) list = list.filter((r) => (r.name && r.name.toLowerCase().includes(q)) || (r.description && r.description.toLowerCase().includes(q)) || (String(r.code || "").includes(q)) || (r.lastMessagePreview && r.lastMessagePreview.toLowerCase().includes(q)));
    if (inboxPage === "mine") list = list.filter(isMine);
    if (inboxPage === "unassigned") list = list.filter((r) => !r.assignedTo);
    if (inboxPage === "new-lead") list = list.filter(isNewLead);
    if (inboxPage === "hot-lead") list = list.filter((r) => r.lifecycleStage === "hot_lead");
    if (inboxPage === "payment") list = list.filter((r) => r.lifecycleStage === "payment");
    if (inboxPage === "customer") list = list.filter((r) => r.lifecycleStage === "customer");
    if (inboxPage === "team" && inboxTeamFilter) list = list.filter((r) => (r.teamName || "—") === inboxTeamFilter);
    if (inboxSort === "unreplied") list = list.filter((r) => r.lastMessageFromUsername && r.lastMessageFromUsername !== config.username);
    if (inboxSort === "newest") list = [...list].sort((a, b) => {
      const at = a.lastMessageAt ? a.lastMessageAt.getTime() : (a.createdAt ? a.createdAt.getTime() : 0);
      const bt = b.lastMessageAt ? b.lastMessageAt.getTime() : (b.createdAt ? b.createdAt.getTime() : 0);
      return bt - at;
    });
    return list;
  })();

  $: inboxCounts = (() => {
    const mine = rooms.filter(isMine).length;
    const unassigned = rooms.filter((r) => !r.assignedTo).length;
    const newLead = rooms.filter(isNewLead).length;
    const hotLead = rooms.filter((r) => r.lifecycleStage === "hot_lead").length;
    const payment = rooms.filter((r) => r.lifecycleStage === "payment").length;
    const customer = rooms.filter((r) => r.lifecycleStage === "customer").length;
    const aiAgent = rooms.filter((r) => r.channelType === "ai_agent").length;
    const byTeam = {};
    rooms.forEach((r) => {
      const t = r.teamName || "—";
      byTeam[t] = (byTeam[t] || 0) + 1;
    });
    return { mine, unassigned, newLead, hotLead, payment, customer, aiAgent, byTeam };
  })();

  function formatInboxDate(room) {
    const d = room.lastMessageAt || room.createdAt;
    if (!d) return "—";
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return "Now";
    if (diff < 3600000) return Math.floor(diff / 60000) + "m";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "h";
    if (diff < 604800000) return Math.floor(diff / 86400000) + "d";
    return new Date(d).toLocaleDateString([], { month: "short", day: "numeric" });
  }

  async function updateRoomMeta(roomId, payload) {
    try {
      const res = await fetch(`${config.serverUrl}/api/rooms/${roomId}/meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) return;
      const updated = await res.json();
      rooms = rooms.map((r) => (r.id === roomId ? { ...r, ...updated } : r));
      if (currentRoom && currentRoom.id === roomId) currentRoom = { ...currentRoom, ...updated };
    } catch (_) {}
  }

  onDestroy(() => {
    if (typeof window !== "undefined") window.removeEventListener("popstate", onPopState);
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
        if (typeof window !== "undefined") window.history.pushState({}, document.title, getPathFromState());
        addNotification("info", "You have been accepted into the room.", 5000);
      }
    } catch (_) {}
  }

  function startInvitePolling() {
    if (inviteStatusAccepted || invitePollTimer) return;
    invitePollTimer = setInterval(pollInviteStatus, 4000);
    pollInviteStatus();
  }

  function connectToServer() {
    socket = io(config.serverUrl, {
      withCredentials: true,
    });

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
      if (typeof window !== "undefined") window.history.pushState({}, document.title, getPathFromState());
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
    goTo("create");
  }

  function handleJoinRoom(room) {
    currentRoom = room;
    currentView = "rooms";
  }

  function handleRoomCreated() {
    loadRooms();
    goTo("rooms", { inboxPage: "all" });
  }

  function handleLeaveRoom() {
    currentRoom = null;
    currentView = "rooms";
    loadRooms();
    if (typeof window !== "undefined") window.history.pushState({}, document.title, getPathFromState());
  }

  function handleBackToRooms() {
    goTo("rooms");
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
    goTo("pending");
    loadPendingRequests();
  }

  function closeProfileDropdown() {
    profileDropdownOpen = false;
  }

  async function handleLogout() {
    try {
      await fetch(`${config.serverUrl}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      window.location.href = "/";
    } catch (err) {
      console.error("Logout failed:", err);
      addNotification("warning", "Failed to logout", 3000);
    }
  }

  async function requestAiReply() {
    if (!currentRoom?.id || aiReplyLoading) return;
    aiReplyLoading = true;
    let workflowContext = null;
    // Prefer the room's assigned agent workflow (when room is assigned to Sales/Marketing/Receptionist)
    const assignedTemplate = getAssignedAgentTemplate(currentRoom.assignedTo);
    if (assignedTemplate) {
      const c = getWorkflowConfig(assignedTemplate);
      if (c && (c.instructions || c.product || c.kpis || c.websiteText || c.documentText)) {
        workflowContext = {
          product: c.product || "",
          kpis: c.kpis || "",
          instructions: [c.instructions, c.websiteText, c.documentText].filter(Boolean).join("\n\n"),
        };
      }
    }
    if (!workflowContext) {
      for (const t of ["sales-engineer", "marketing-engineer", "receptionist"]) {
        const c = getWorkflowConfig(t);
        if (c && (c.instructions || c.product || c.kpis || c.websiteText || c.documentText)) {
          workflowContext = {
            product: c.product || "",
            kpis: c.kpis || "",
            instructions: [c.instructions, c.websiteText, c.documentText].filter(Boolean).join("\n\n"),
          };
          break;
        }
      }
    }
    try {
      const res = await fetch(`${config.serverUrl}/api/ai/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ roomId: currentRoom.id, workflowContext }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.reply) {
        messageDraft = data.reply;
        addNotification("info", "AI reply inserted. Edit if needed and send.", 4000);
      } else {
        addNotification("warning", data.error || "Could not generate reply.", 5000);
      }
    } catch (e) {
      addNotification("warning", e.message || "Failed to get AI reply.", 5000);
    } finally {
      aiReplyLoading = false;
    }
  }

  function loadWorkflowTrainData() {
    if (!workflowTrainTemplate) return;
    const c = getWorkflowConfig(workflowTrainTemplate);
    workflowTrainProduct = c?.product ?? "";
    workflowTrainKpis = c?.kpis ?? "";
    workflowTrainInstructions = c?.instructions ?? "";
    workflowTrainWebsiteText = c?.websiteText ?? "";
    workflowTrainDocumentText = c?.documentText ?? "";
  }

  async function fetchWebsiteForTrain() {
    const url = workflowTrainUrlInput.trim();
    if (!url) return;
    workflowTrainUrlLoading = true;
    try {
      const res = await fetch(`${config.serverUrl}/api/ai/fetch-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.text) {
        workflowTrainWebsiteText = (workflowTrainWebsiteText ? workflowTrainWebsiteText + "\n\n" : "") + data.text;
        addNotification("info", "Content added from website.", 4000);
      } else {
        addNotification("warning", data.error || "Could not fetch URL.", 5000);
      }
    } catch (e) {
      addNotification("warning", e.message || "Failed to fetch URL.", 5000);
    } finally {
      workflowTrainUrlLoading = false;
    }
  }

  async function uploadDocumentForTrain(e) {
    const file = e?.target?.files?.[0];
    if (!file) return;
    workflowTrainUploadLoading = true;
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${config.serverUrl}/api/ai/upload-document`, {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.text) {
        workflowTrainDocumentText = (workflowTrainDocumentText ? workflowTrainDocumentText + "\n\n" : "") + data.text;
        addNotification("info", "Document content added.", 4000);
      } else {
        addNotification("warning", data.error || "Could not extract text from document.", 5000);
      }
    } catch (err) {
      addNotification("warning", err.message || "Upload failed.", 5000);
    } finally {
      workflowTrainUploadLoading = false;
      e.target.value = "";
    }
  }

  async function saveWorkflowTrain() {
    if (!workflowTrainTemplate) return;
    const data = {
      product: workflowTrainProduct,
      kpis: workflowTrainKpis,
      instructions: workflowTrainInstructions,
      websiteText: workflowTrainWebsiteText,
      documentText: workflowTrainDocumentText,
    };
    setWorkflowConfig(workflowTrainTemplate, data);
    if (config.serverUrl) {
      try {
        await fetch(`${config.serverUrl}/api/workflows/${workflowTrainTemplate}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(data),
        });
      } catch (_) {}
    }
    addNotification("info", "Agent saved. Assign a room to this agent to have it auto-respond, or use \"Respond with AI\" in a conversation.", 6000);
    goTo("workflows");
  }

  $: workflowTrainTitle =
    workflowTrainTemplate === "sales-engineer"
      ? "Sales Engineer"
      : workflowTrainTemplate === "marketing-engineer"
        ? "Marketing Engineer"
        : workflowTrainTemplate === "receptionist"
          ? "Receptionist"
          : "Workflow";
</script>

<svelte:window onclick={() => { if (profileDropdownOpen) closeProfileDropdown(); if (lifecycleNavOpen) lifecycleNavOpen = false; if (teamsNavOpen) teamsNavOpen = false; }} />


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
      {:else if currentView === "workflows"}
        <span>Workflows</span>
      {:else if currentView === "workflow-train"}
        <span>Train your agent: {workflowTrainTitle}</span>
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
            <div class="header-profile-user-info">
              <span class="header-profile-user-name">{user?.name || config.username}</span>
              {#if user?.email}<span class="header-profile-user-email">{user.email}</span>{/if}
              {#if user?.isCustomer || user?.isBusiness}
                <div class="header-profile-badges">
                  {#if user.isCustomer}<span class="header-profile-badge badge-customer">Customer</span>{/if}
                  {#if user.isBusiness}<span class="header-profile-badge badge-business">Business</span>{/if}
                </div>
              {/if}
            </div>
            <div class="header-profile-divider"></div>
            <button type="button" class="header-profile-item" role="menuitem" onclick={() => { profileDropdownOpen = false; goTo('settings'); }}>Manage profile</button>
            <button type="button" class="header-profile-item" role="menuitem" onclick={() => { profileDropdownOpen = false; goTo('settings'); }}>Manage account</button>
            <div class="header-profile-divider"></div>
            <button type="button" class="header-profile-item header-profile-signout" role="menuitem" onclick={() => { profileDropdownOpen = false; handleLogout(); }}>Log out</button>
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
        <button type="button" class="notification-message-btn" onclick={() => { goTo('pending'); dismissNotification(n.id); }} aria-label="Open notifications">
          <span class="notification-message">{n.message}</span>
        </button>
        <button type="button" class="notification-dismiss" onclick={(e) => { e.stopPropagation(); dismissNotification(n.id); }} aria-label="Dismiss">×</button>
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

  <div class="layout" class:layout-context-expanded={contextBarExpanded}>
    <nav class="sidebar sidebar-respondio" aria-label="Primary navigation">
      <ul class="sidebar-list">
        <li>
          <button type="button" class="sidebar-item sidebar-item-with-badge" class:active={currentView === "dashboard"} onclick={() => goTo("dashboard")} aria-current={currentView === "dashboard" ? "page" : undefined} title="Dashboard" aria-label={rooms.length ? "Dashboard (" + rooms.length + ")" : "Dashboard"}>
            <span class="sidebar-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
            </span>
            <span class="sidebar-label">Dashboard</span>
          </button>
        </li>
        <li>
          <button type="button" class="sidebar-item sidebar-item-with-badge" class:active={currentView === "rooms"} onclick={() => goTo("rooms", { inboxPage: "all" })} aria-current={currentView === "rooms" ? "page" : undefined} title="Messages" aria-label={rooms.length ? "Messages (" + rooms.length + ")" : "Messages"}>
            <span class="sidebar-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><circle cx="12" cy="10" r="1.5" fill="currentColor"/></svg>
            </span>
            <span class="sidebar-label">Messages</span>
            {#if rooms.length > 0}
              <span class="sidebar-badge" aria-hidden="true">{rooms.length > 99 ? "99+" : rooms.length}</span>
            {/if}
          </button>
        </li>
        <li>
          <button type="button" class="sidebar-item sidebar-item-with-badge" class:active={currentView === "pending"} onclick={() => goTo("pending")} aria-current={currentView === "pending" ? "page" : undefined} title="Notifications" aria-label={pendingRequests.length ? "Notifications (" + pendingRequests.length + " pending)" : "Notifications"}>
            <span class="sidebar-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            </span>
            <span class="sidebar-label">Notifications</span>
            {#if pendingRequests.length > 0}
              <span class="sidebar-badge" aria-hidden="true">{pendingRequests.length > 99 ? "99+" : pendingRequests.length}</span>
            {/if}
          </button>
        </li>
        <li>
          <button type="button" class="sidebar-item" class:active={currentView === "contacts"} onclick={() => goTo("contacts")} aria-current={currentView === "contacts" ? "page" : undefined} title="Contacts" aria-label="Contacts">
            <span class="sidebar-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </span>
            <span class="sidebar-label">Contacts</span>
          </button>
        </li>
        <li>
          <button type="button" class="sidebar-item" class:active={currentView === "rooms" && inboxPage === "campaigns"} onclick={() => goTo("rooms", { inboxPage: "campaigns" })} title="Campaigns" aria-label="Campaigns">
            <span class="sidebar-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z"/><path d="M12 6v2h4V6a2 2 0 0 0-4 0z"/></svg>
            </span>
            <span class="sidebar-label">Campaigns</span>
          </button>
        </li>
        <li>
          <button type="button" class="sidebar-item" class:active={currentView === "workflows"} onclick={() => goTo("workflows")} aria-current={currentView === "workflows" ? "page" : undefined} title="Workflows" aria-label="Workflows">
            <span class="sidebar-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="6" cy="18" r="3"/><line x1="18" y1="3" x2="18" y2="15"/><circle cx="18" cy="18" r="3"/><line x1="6" y1="12" x2="18" y2="12"/></svg>
            </span>
            <span class="sidebar-label">Workflows</span>
          </button>
        </li>
        <li>
          <button type="button" class="sidebar-item" onclick={() => goTo("dashboard")} title="Analytics" aria-label="Analytics">
            <span class="sidebar-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            </span>
            <span class="sidebar-label">Analytics</span>
          </button>
        </li>
        <li>
          <button type="button" class="sidebar-item" class:active={currentView === "settings"} onclick={() => goTo("settings")} aria-current={currentView === "settings" ? "page" : undefined} title="Settings">
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
        <button type="button" class="sidebar-profile" onclick={() => { profileDropdownOpen = !profileDropdownOpen; }} title="{config.username}" aria-label="Profile (User avatar)">
          <span class="sidebar-profile-avatar">{config.username ? config.username.charAt(0).toUpperCase() : "?"}</span>
          <span class="sidebar-profile-dot" class:online={isConnected} aria-hidden="true"></span>
        </button>
        <div class="sidebar-logo sidebar-logo-bottom" title="Nego">
          <img src="/images/nego.png" alt="Company" class="sidebar-logo-img" />
        </div>
      </div>
    </nav>

    <div class="body" style="min-width: 0;">
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
                    <button type="button" class="channels-card-cta" onclick={() => goTo('integrations')}>Connect Channel</button>
                  </div>
                </div>
              </section>
              <section class="dashboard-lifecycle" aria-labelledby="lifecycle-heading">
                <h2 id="lifecycle-heading" class="dashboard-section-heading">Lifecycle</h2>
                <div class="lifecycle-grid">
                  <div class="lifecycle-card">
                    <span class="lifecycle-icon lifecycle-new" aria-hidden="true">New Lead</span>
                    <span class="lifecycle-count">{inboxCounts.newLead}</span>
                    <span class="lifecycle-pct">{rooms.length ? ((inboxCounts.newLead / rooms.length) * 100).toFixed(2) : "0.00"}%</span>
                  </div>
                  <div class="lifecycle-card">
                    <span class="lifecycle-icon lifecycle-hot" aria-hidden="true">Hot Lead</span>
                    <span class="lifecycle-count">{inboxCounts.hotLead}</span>
                    <span class="lifecycle-pct">{rooms.length ? ((inboxCounts.hotLead / rooms.length) * 100).toFixed(2) : "0.00"}%</span>
                  </div>
                  <div class="lifecycle-card">
                    <span class="lifecycle-icon lifecycle-payment" aria-hidden="true">Payment</span>
                    <span class="lifecycle-count">{inboxCounts.payment}</span>
                    <span class="lifecycle-pct">{rooms.length ? ((inboxCounts.payment / rooms.length) * 100).toFixed(2) : "0.00"}%</span>
                  </div>
                  <div class="lifecycle-card">
                    <span class="lifecycle-icon lifecycle-customer" aria-hidden="true">Customer</span>
                    <span class="lifecycle-count">{inboxCounts.customer}</span>
                    <span class="lifecycle-pct">{rooms.length ? ((inboxCounts.customer / rooms.length) * 100).toFixed(2) : "0.00"}%</span>
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
                      <span class="team-member-meta">Assigned to {inboxCounts.mine} contacts · Since {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </li>
                </ul>
              </section>
            </div>
          </div>
        {:else if currentView === "workflows"}
          <div class="view-wrap view-workflows">
            <header class="workflows-header">
              <h1 class="workflows-page-title">Workflows</h1>
              <p class="workflows-intro">Automate conversations and negotiation with AI. Use Gemini to drive KPIs and outcomes. Start with a beginner template below and add your data to customize.</p>
            </header>
            <section class="workflows-templates" aria-labelledby="workflows-templates-heading">
              <h2 id="workflows-templates-heading" class="workflows-section-heading">Beginner templates</h2>
              <div class="workflow-template-grid">
                <article class="workflow-template-card">
                  <div class="workflow-template-icon workflow-template-icon-sales" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M12 8v4l2 2"/></svg>
                  </div>
                  <h3 class="workflow-template-title">Sales Engineer</h3>
                  <p class="workflow-template-desc">Qualify leads, demo products, and close deals. Use AI to suggest talking points and track negotiation KPIs.</p>
                  <button type="button" class="workflow-template-cta" onclick={() => goToWorkflowTrain("sales-engineer")}>Add your data</button>
                </article>
                <article class="workflow-template-card">
                  <div class="workflow-template-icon workflow-template-icon-marketing" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  </div>
                  <h3 class="workflow-template-title">Marketing Engineer</h3>
                  <p class="workflow-template-desc">Nurture leads, run campaigns, and align messaging. AI helps with copy and campaign performance against your KPIs.</p>
                  <button type="button" class="workflow-template-cta" onclick={() => goToWorkflowTrain("marketing-engineer")}>Add your data</button>
                </article>
                <article class="workflow-template-card">
                  <div class="workflow-template-icon workflow-template-icon-reception" aria-hidden="true">
                    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </div>
                  <h3 class="workflow-template-title">Receptionist</h3>
                  <p class="workflow-template-desc">Greet contacts, route inquiries, and book meetings. AI handles FAQs and hands off to the right team based on your rules.</p>
                  <button type="button" class="workflow-template-cta" onclick={() => goToWorkflowTrain("receptionist")}>Add your data</button>
                </article>
              </div>
            </section>
            <section class="workflows-ai-section" aria-labelledby="workflows-ai-heading">
              <h2 id="workflows-ai-heading" class="workflows-section-heading">AI &amp; APIs</h2>
              <p class="workflows-ai-desc">Connect Gemini in Settings to power negotiation KPIs and automated responses. Workflow triggers and conditions will be configurable here next.</p>
              <button type="button" class="workflow-template-cta workflows-ai-cta" onclick={() => goTo('settings')}>Go to Settings</button>
            </section>
          </div>
        {:else if currentView === "workflow-train"}
          <div class="view-wrap view-workflow-train">
            <header class="workflow-train-header">
              <button type="button" class="btn-back" onclick={() => goTo("workflows")}>Back to Workflows</button>
              <h1 class="workflow-train-page-title">Train your agent: {workflowTrainTitle}</h1>
              <p class="workflow-train-intro">Give your agent all the data it needs to negotiate and respond for you: product, KPIs, content from your website, and documents. Your Gemini API key is configured server-side.</p>
            </header>
            <div class="workflow-train-content">
              <section class="workflow-train-section" aria-labelledby="train-product-heading">
                <h2 id="train-product-heading" class="workflow-train-section-heading">Product / service</h2>
                <input type="text" class="workflow-train-input" placeholder="e.g. Enterprise plan, Consulting" bind:value={workflowTrainProduct} aria-describedby="train-product-desc" />
                <p id="train-product-desc" class="workflow-train-desc">What you sell or offer. The agent will use this to tailor replies.</p>
              </section>
              <section class="workflow-train-section" aria-labelledby="train-kpis-heading">
                <h2 id="train-kpis-heading" class="workflow-train-section-heading">KPIs and goals</h2>
                <input type="text" class="workflow-train-input" placeholder="e.g. Close rate, Response time, Customer satisfaction" bind:value={workflowTrainKpis} aria-describedby="train-kpis-desc" />
                <p id="train-kpis-desc" class="workflow-train-desc">Metrics and outcomes the agent should optimize for.</p>
              </section>
              <section class="workflow-train-section" aria-labelledby="train-website-heading">
                <h2 id="train-website-heading" class="workflow-train-section-heading">Add from your website</h2>
                <p class="workflow-train-desc">Scrape content from a URL to train the agent on your site’s information.</p>
                <div class="workflow-train-url-row">
                  <input type="url" class="workflow-train-input workflow-train-url-input" placeholder="https://yoursite.com/about" bind:value={workflowTrainUrlInput} />
                  <button type="button" class="workflow-train-fetch-btn" onclick={fetchWebsiteForTrain} disabled={workflowTrainUrlLoading || !workflowTrainUrlInput.trim()}>
                    {workflowTrainUrlLoading ? "Fetching…" : "Fetch"}
                  </button>
                </div>
                {#if workflowTrainWebsiteText}
                  <div class="workflow-train-text-preview">
                    <span class="workflow-train-preview-label">Content added:</span>
                    <p class="workflow-train-preview-text">{workflowTrainWebsiteText.length} characters</p>
                  </div>
                {/if}
              </section>
              <section class="workflow-train-section" aria-labelledby="train-docs-heading">
                <h2 id="train-docs-heading" class="workflow-train-section-heading">Upload documents</h2>
                <p class="workflow-train-desc">Upload PDFs or text files. Their content will be used to train the agent.</p>
                <input type="file" class="workflow-train-file-input" accept=".pdf,.txt,text/plain,application/pdf" onchange={uploadDocumentForTrain} disabled={workflowTrainUploadLoading} aria-label="Choose file" />
                {#if workflowTrainUploadLoading}<span class="workflow-train-loading">Uploading…</span>{/if}
                {#if workflowTrainDocumentText}
                  <div class="workflow-train-text-preview">
                    <span class="workflow-train-preview-label">Document content added:</span>
                    <p class="workflow-train-preview-text">{workflowTrainDocumentText.length} characters</p>
                  </div>
                {/if}
              </section>
              <section class="workflow-train-section workflow-train-section-full" aria-labelledby="train-instructions-heading">
                <h2 id="train-instructions-heading" class="workflow-train-section-heading">Agent instructions</h2>
                <p class="workflow-train-desc">How should your agent behave? Tone, rules, and extra context. Like training a GPT. This plus product, KPIs, website content, and documents are sent to Gemini when you use &quot;Respond with AI&quot; in a conversation.</p>
                <textarea class="workflow-train-textarea" placeholder="e.g. Be professional and concise. Always mention our 24/7 support. Never promise discounts without approval." bind:value={workflowTrainInstructions} rows="8" aria-describedby="train-instructions-desc"></textarea>
              </section>
              <div class="workflow-train-actions">
                <button type="button" class="workflow-train-save-btn" onclick={saveWorkflowTrain}>Save and use this agent</button>
              </div>
            </div>
          </div>
        {:else if currentView === "rooms"}
          <div class="view-wrap view-rooms">
            <!-- Top tab bar: All, Mine, Unassigned, Incoming Calls, AI Agents, Lifecycle, Campaigns, VIP Clients -->
            <nav class="inbox-top-nav" aria-label="Inbox navigation">
              <div class="inbox-top-nav-tabs">
                <button type="button" class="inbox-top-tab" class:active={inboxPage === "all"} onclick={() => goTo("rooms", { inboxPage: "all" })}>All <span class="inbox-top-tab-count">{rooms.length}</span></button>
                <button type="button" class="inbox-top-tab" class:active={inboxPage === "mine"} onclick={() => goTo("rooms", { inboxPage: "mine" })}>Mine <span class="inbox-top-tab-count">{inboxCounts.mine}</span></button>
                <button type="button" class="inbox-top-tab" class:active={inboxPage === "unassigned"} onclick={() => goTo("rooms", { inboxPage: "unassigned" })}>Unassigned <span class="inbox-top-tab-count">{inboxCounts.unassigned}</span></button>
                <button type="button" class="inbox-top-tab" class:active={inboxPage === "incoming-calls"} onclick={() => goTo("rooms", { inboxPage: "incoming-calls" })}>Incoming Calls <span class="inbox-top-tab-count">0</span></button>
                <button type="button" class="inbox-top-tab" class:active={inboxPage === "ai-agents"} onclick={() => goTo("rooms", { inboxPage: "ai-agents" })}>AI Agents <span class="inbox-top-tab-count">{inboxCounts.aiAgent}</span></button>
                <div class="inbox-top-tab-dropdown" role="presentation">
                  <button type="button" class="inbox-top-tab" class:active={["new-lead","hot-lead","payment","customer"].includes(inboxPage)} aria-expanded={lifecycleNavOpen} aria-haspopup="true" onclick={() => { lifecycleNavOpen = !lifecycleNavOpen; teamsNavOpen = false; }}>Lifecycle ▾</button>
                  {#if lifecycleNavOpen}
                    <div class="inbox-top-tab-menu" role="menu">
                      <button type="button" class="inbox-top-tab-menu-item" class:active={inboxPage === "new-lead"} role="menuitem" onclick={() => goTo("rooms", { inboxPage: "new-lead" })}>New Lead ({inboxCounts.newLead})</button>
                      <button type="button" class="inbox-top-tab-menu-item" class:active={inboxPage === "hot-lead"} role="menuitem" onclick={() => goTo("rooms", { inboxPage: "hot-lead" })}>Hot Lead ({inboxCounts.hotLead})</button>
                      <button type="button" class="inbox-top-tab-menu-item" class:active={inboxPage === "payment"} role="menuitem" onclick={() => goTo("rooms", { inboxPage: "payment" })}>Payment ({inboxCounts.payment})</button>
                      <button type="button" class="inbox-top-tab-menu-item" class:active={inboxPage === "customer"} role="menuitem" onclick={() => goTo("rooms", { inboxPage: "customer" })}>Customer ({inboxCounts.customer})</button>
                    </div>
                  {/if}
                </div>
                <div class="inbox-top-tab-dropdown" role="presentation">
                  <button type="button" class="inbox-top-tab" class:active={inboxPage === "team"} aria-expanded={teamsNavOpen} aria-haspopup="true" onclick={() => { teamsNavOpen = !teamsNavOpen; lifecycleNavOpen = false; }}>Teams ▾</button>
                  {#if teamsNavOpen}
                    <div class="inbox-top-tab-menu" role="menu">
                      {#each Object.entries(inboxCounts.byTeam).filter(([name]) => name !== "—").sort((a, b) => a[0].localeCompare(b[0])) as [teamName, count]}
                        <button type="button" class="inbox-top-tab-menu-item" class:active={inboxPage === "team" && inboxTeamFilter === teamName} role="menuitem" onclick={() => goTo("rooms", { inboxPage: "team", inboxTeamFilter: teamName })}>{teamName} ({count})</button>
                      {/each}
                      {#if Object.keys(inboxCounts.byTeam).filter((k) => k !== "—").length === 0}
                        <span class="inbox-top-tab-menu-item inbox-top-tab-menu-empty">No teams</span>
                      {/if}
                    </div>
                  {/if}
                </div>
                <button type="button" class="inbox-top-tab" class:active={inboxPage === "campaigns"} onclick={() => goTo("rooms", { inboxPage: "campaigns" })}>Campaigns</button>
                <button type="button" class="inbox-top-tab" class:active={inboxPage === "vip-clients"} onclick={() => goTo("rooms", { inboxPage: "vip-clients" })}>VIP Clients</button>
              </div>
            </nav>

            {#if inboxShowsChatsList}
              <div class="view-inbox-twopane">
                <!-- Left pane: only Chats + search + list + footer -->
                <aside class="inbox-pane inbox-pane-list" aria-label="Chats">
                  <div class="inbox-chats-header">
                    <span class="inbox-chats-title">Chats</span>
                    <div class="inbox-chats-sort">
                      <button type="button" class="inbox-filter-btn" class:active={inboxSort === "newest"} onclick={() => (inboxSort = "newest")}>All / Newest</button>
                      <button type="button" class="inbox-filter-btn" class:active={inboxSort === "unreplied"} onclick={() => (inboxSort = "unreplied")}>Unreplied</button>
                    </div>
                  </div>
                  <div class="inbox-chats-actions">
                    <button type="button" class="btn-inbox-create-room-top" onclick={handleCreateRoom} title="Create a new room">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      <span>Create room</span>
                    </button>
                  </div>
                  <div class="inbox-chats-search-wrap">
                    <input type="search" class="inbox-search" placeholder="Search conversations..." bind:value={inboxSearch} aria-label="Search conversations" />
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
                          <div class="inbox-conv-avatar-wrap">
                            <span class="inbox-conv-avatar" aria-hidden="true">{room.name ? room.name.charAt(0).toUpperCase() : "?"}</span>
                            <span class="inbox-conv-avatar-dot online" aria-hidden="true"></span>
                            <span class="inbox-conv-channel-overlay" aria-hidden="true" title="Chat">
                              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            </span>
                          </div>
                          <div class="inbox-conv-main">
                            <div class="inbox-conv-top">
                              <span class="inbox-conv-name">{room.name}</span>
                              <span class="inbox-conv-date">{formatInboxDate(room)}</span>
                            </div>
                            <p class="inbox-conv-snippet">
                              <span class="inbox-conv-direction" aria-hidden="true" title={room.lastMessageFromUsername === config.username ? "Outbound" : "Inbound"}>{room.lastMessageFromUsername === config.username ? "→" : "←"}</span>
                              {room.lastMessagePreview || room.description || "No messages yet"}
                            </p>
                            {#if hasPending}<span class="inbox-conv-tag status-new-lead">New Lead</span>{:else if room.lifecycleStage === "hot_lead"}<span class="inbox-conv-tag status-hot-lead">Hot Lead</span>{:else if room.lifecycleStage === "payment"}<span class="inbox-conv-tag status-payment">Payment</span>{:else if room.lifecycleStage === "customer"}<span class="inbox-conv-tag status-customer">Customer</span>{/if}
                          </div>
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
                        bind:messageDraft
                        getSendMessage={(fn) => { sendMessageRef = fn; }}
                        onLeaveRoom={handleLeaveRoom}
                        onRoomMetaChange={(updated) => { currentRoom = { ...currentRoom, ...updated }; rooms = rooms.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)); }}
                      />
                    </div>
                    <!-- Message input bar: rendered here so always visible (outside chat flex chain) -->
                    <div class="chat-input-bar-module">
                      <div class="chat-input-bar-inner">
                        <button
                          type="button"
                          class="chat-input-bar-ai"
                          onclick={requestAiReply}
                          disabled={aiReplyLoading}
                          title="Respond with AI – generate a reply, then click Send to send it"
                          aria-label="Respond with AI"
                        >
                          {#if aiReplyLoading}
                            <span class="chat-input-bar-ai-spinner" aria-hidden="true"></span>
                          {:else}
                            <svg class="chat-input-bar-ai-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M5 18l1.5-2L9 17.5 6.5 19 5 18z"/><path d="M19 18l-1.5-2L15 17.5l2.5 1.5L19 18z"/></svg>
                          {/if}
                        </button>
                        <textarea
                          bind:value={messageDraft}
                          placeholder="Type your message…"
                          rows="1"
                          class="chat-input-bar-textarea"
                          aria-label="Message"
                          onkeydown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              if (sendMessageRef && messageDraft.trim()) sendMessageRef();
                            }
                          }}
                        ></textarea>
                        <button
                          type="button"
                          class="chat-input-bar-send"
                          onclick={() => { if (sendMessageRef) sendMessageRef(); }}
                          disabled={!messageDraft.trim()}
                          aria-label="Send"
                        >
                          Send
                        </button>
                      </div>
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
            {:else}
              <!-- Config / other pages: AI Agents, Incoming Calls, Campaigns, VIP Clients -->
              <div class="inbox-page-placeholder">
                {#if inboxPage === "ai-agents"}
                  <div class="inbox-placeholder-content">
                    <h2 class="inbox-placeholder-title">AI Agents</h2>
                    <p class="inbox-placeholder-desc">Configure your AI agents (e.g. AI Sales Agent) and assign conversations. This page will let you set up and manage AI-powered inboxes.</p>
                    <button type="button" class="inbox-placeholder-cta" onclick={() => goTo('settings')}>Go to Settings</button>
                  </div>
                {:else if inboxPage === "incoming-calls"}
                  <div class="inbox-page-incoming-calls">
                    <h2 class="inbox-page-title">Incoming Calls</h2>
                    <p class="inbox-page-desc">Calls that are waiting or recently received appear here.</p>
                    <div class="inbox-calls-list">
                      <div class="inbox-calls-empty" aria-live="polite">
                        <span class="inbox-calls-empty-icon" aria-hidden="true">📞</span>
                        <p class="inbox-calls-empty-title">No incoming calls</p>
                        <p class="inbox-calls-empty-desc">When you connect a voice channel, incoming calls will show up here.</p>
                      </div>
                    </div>
                  </div>
                {:else if inboxPage === "campaigns"}
                  <div class="inbox-placeholder-content">
                    <h2 class="inbox-placeholder-title">Campaigns</h2>
                    <p class="inbox-placeholder-desc">Manage your campaigns and campaign-based conversations. Create campaigns to group conversations by campaign.</p>
                  </div>
                {:else if inboxPage === "vip-clients"}
                  <div class="inbox-placeholder-content">
                    <h2 class="inbox-placeholder-title">VIP Clients</h2>
                    <p class="inbox-placeholder-desc">Conversations and contacts marked as VIP. Configure VIP inboxes and rules in Settings.</p>
                    <button type="button" class="inbox-placeholder-cta" onclick={() => goTo('settings')}>Go to Settings</button>
                  </div>
                {:else}
                  <div class="inbox-placeholder-content">
                    <h2 class="inbox-placeholder-title">Inbox</h2>
                    <p class="inbox-placeholder-desc">Select a view from the tabs above (All, Mine, Unassigned, Lifecycle, etc.) to see conversations.</p>
                  </div>
                {/if}
              </div>
            {/if}
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
              <button type="button" class="btn-back-contacts" onclick={() => goTo("dashboard")}>Back</button>
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

    <aside class="context-bar" aria-label="Context" class:expanded={contextBarExpanded}>
      <button type="button" class="context-bar-toggle" onclick={() => (contextBarExpanded = !contextBarExpanded)} aria-expanded={contextBarExpanded} aria-label={contextBarExpanded ? "Collapse context bar" : "Expand context bar"} title={contextBarExpanded ? "Collapse" : "Expand"}>
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      {#if contextBarExpanded}
        <div class="context-bar-content">
          <p class="context-bar-title">Context</p>
          {#if currentRoom}
            <p class="context-bar-room">{currentRoom.name}</p>
            {#if currentRoom.description}<p class="context-bar-desc">{currentRoom.description}</p>{/if}
            <div class="context-bar-meta">
              <label class="context-bar-label" for="context-assigned">Assigned to</label>
              {#if currentRoom.assignedTo && (currentRoom.assignedTo.startsWith?.('agent:') ?? false)}
                <span class="context-bar-assigned-display" id="context-assigned">{getAssignedToDisplay(currentRoom.assignedTo)} <span class="context-bar-agent-badge">Agent</span></span>
              {:else}
                <input id="context-assigned" type="text" class="context-bar-input" placeholder="Username" bind:value={contextAssignedTo} onblur={() => { const v = contextAssignedTo.trim(); if (currentRoom && String(currentRoom.assignedTo ?? "") !== v) updateRoomMeta(currentRoom.id, { assignedTo: v || null }); }} />
              {/if}
              <label class="context-bar-label" for="context-lifecycle">Lifecycle</label>
              <select id="context-lifecycle" class="context-bar-select" bind:value={contextLifecycle} onchange={() => { if (currentRoom && currentRoom.lifecycleStage !== contextLifecycle) updateRoomMeta(currentRoom.id, { lifecycleStage: contextLifecycle || null }); }}>
                <option value="">—</option>
                <option value="new_lead">New Lead</option>
                <option value="hot_lead">Hot Lead</option>
                <option value="payment">Payment</option>
                <option value="customer">Customer</option>
              </select>
              <label class="context-bar-label" for="context-team">Team</label>
              <input id="context-team" type="text" class="context-bar-input" placeholder="Team name" bind:value={contextTeamName} onblur={() => { const v = contextTeamName.trim(); if (currentRoom && String(currentRoom.teamName ?? "") !== v) updateRoomMeta(currentRoom.id, { teamName: v || null }); }} />
            </div>
          {:else}
            <p class="context-bar-empty">Select a conversation</p>
          {/if}
        </div>
      {/if}
    </aside>
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
    display: grid;
    grid-template-columns: 64px 1fr 48px;
    overflow: hidden;
    height: 100vh;
    min-height: 100vh;
  }

  .layout-context-expanded {
    grid-template-columns: 64px 1fr 280px;
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
    width: 64px;
    min-width: 64px;
    padding: 0.5rem 0;
    align-items: center;
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
    padding: 0.5rem;
    justify-content: center;
    gap: 0;
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
    display: none;
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
    padding: 0.5rem;
    justify-content: center;
    margin-bottom: 0.5rem;
    width: 48px;
    height: 48px;
  }

  .sidebar-logo-bottom {
    margin-bottom: 0;
    margin-top: 0.5rem;
    width: 40px;
    height: 40px;
    padding: 0.35rem;
  }

  .sidebar-logo-bottom .sidebar-logo-img {
    width: 28px;
    height: 28px;
    min-width: 28px;
    min-height: 28px;
  }

  .sidebar-respondio .sidebar-logo-img {
    width: 36px;
    height: 36px;
    min-width: 36px;
    min-height: 36px;
    object-fit: contain;
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
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
    min-width: 0;
  }

  .view-wrap {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    animation: viewIn 0.3s var(--ease-out-expo);
  }

  .view-workflows {
    overflow-y: auto;
    padding: 1.5rem;
    padding-bottom: 2rem;
    background: var(--bg-primary);
    min-height: 100%;
  }

  .workflows-header {
    margin-bottom: 1.5rem;
  }

  .workflows-page-title {
    margin: 0 0 0.5rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  .workflows-intro {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--text-secondary);
    line-height: 1.5;
    max-width: 100%;
  }

  .workflows-section-heading {
    margin: 0 0 1rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .workflows-templates {
    margin-bottom: 2rem;
  }

  .workflow-template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.25rem;
  }

  .workflow-template-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 1.25rem;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 14px;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .workflow-template-card:hover {
    border-color: var(--navy-400);
    box-shadow: 0 8px 24px rgba(13, 33, 55, 0.08);
  }

  .workflow-template-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    flex-shrink: 0;
  }

  .workflow-template-icon-sales {
    background: var(--green-100);
    color: var(--green-700);
  }

  .workflow-template-icon-marketing {
    background: var(--navy-100);
    color: var(--navy-700);
  }

  .workflow-template-icon-reception {
    background: var(--amber-100, #fef3c7);
    color: var(--amber-700, #b45309);
  }

  .workflow-template-title {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .workflow-template-desc {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.5;
    flex: 1;
  }

  .workflow-template-cta {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .workflow-template-cta:hover {
    background: var(--gray-200);
  }

  .view-workflow-train {
    overflow-y: auto;
    padding: 1.5rem;
    padding-bottom: 2rem;
    background: var(--bg-primary);
    min-height: 100%;
    display: flex;
    flex-direction: column;
  }

  .workflow-train-header {
    margin-bottom: 1.5rem;
    flex-shrink: 0;
  }

  .workflow-train-header .btn-back {
    margin-bottom: 0.75rem;
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

  .workflow-train-header .btn-back:hover {
    background: var(--gray-200);
  }

  .workflow-train-page-title {
    margin: 0 0 0.5rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  .workflow-train-intro {
    margin: 0;
    font-size: 0.9375rem;
    color: var(--text-secondary);
    line-height: 1.5;
    max-width: 100%;
  }

  .workflow-train-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    flex: 1;
    min-width: 0;
    align-content: start;
  }

  @media (max-width: 900px) {
    .workflow-train-content {
      grid-template-columns: 1fr;
    }
  }

  .workflow-train-section {
    padding: 1.25rem;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 14px;
  }

  .workflow-train-section-full {
    grid-column: 1 / -1;
  }

  .workflow-train-section-heading {
    margin: 0 0 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .workflow-train-desc {
    margin: 0 0 0.75rem;
    font-size: 0.8125rem;
    color: var(--text-secondary);
    line-height: 1.45;
  }

  .workflow-train-input {
    display: block;
    width: 100%;
    max-width: 100%;
    padding: 0.5rem 0.75rem;
    border: 2px solid var(--border);
    border-radius: 8px;
    font-size: 0.9375rem;
    font-family: inherit;
    background: var(--input-bg);
    color: var(--text-primary);
  }

  .workflow-train-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .workflow-train-url-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .workflow-train-url-input {
    flex: 1;
    min-width: 200px;
  }

  .workflow-train-fetch-btn {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--green-600);
    color: white;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .workflow-train-fetch-btn:hover:not(:disabled) {
    background: var(--green-700);
  }

  .workflow-train-fetch-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .workflow-train-file-input {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.875rem;
  }

  .workflow-train-loading {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin-left: 0.5rem;
  }

  .workflow-train-text-preview {
    margin-top: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg-secondary);
    border-radius: 8px;
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .workflow-train-preview-label {
    font-weight: 600;
    color: var(--text-primary);
  }

  .workflow-train-preview-text {
    margin: 0.25rem 0 0;
  }

  .workflow-train-textarea {
    display: block;
    width: 100%;
    min-height: 160px;
    padding: 0.75rem;
    border: 2px solid var(--border);
    border-radius: 8px;
    font-size: 0.9375rem;
    font-family: inherit;
    background: var(--input-bg);
    color: var(--text-primary);
    resize: vertical;
  }

  .workflow-train-textarea:focus {
    outline: none;
    border-color: var(--accent);
  }

  .workflow-train-actions {
    margin-top: 0.5rem;
    grid-column: 1 / -1;
  }

  .workflow-train-save-btn {
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    border: none;
    background: var(--green-600);
    color: white;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }

  .workflow-train-save-btn:hover {
    background: var(--green-700);
  }

  .workflows-ai-section {
    padding: 1.25rem;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 14px;
    max-width: 100%;
  }

  .workflows-ai-desc {
    margin: 0 0 1rem;
    font-size: 0.9375rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .workflows-ai-cta {
    margin-top: 0.25rem;
  }

  .view-rooms {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  .inbox-top-nav {
    flex-shrink: 0;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--border);
    background: var(--card-bg);
  }

  .inbox-top-nav-tabs {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
  }

  .inbox-top-tab {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.65rem;
    border: none;
    background: none;
    color: var(--text-secondary);
    font-size: 0.8125rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    border-radius: 6px;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .inbox-top-tab:hover {
    background: var(--gray-100);
    color: var(--text-primary);
  }

  .inbox-top-tab.active {
    background: var(--navy-100, var(--gray-200));
    color: var(--navy-800, var(--gray-900));
  }

  .inbox-top-tab-count {
    font-size: 0.75rem;
    color: var(--gray-500);
  }

  .inbox-top-tab-dropdown {
    position: relative;
    display: inline-block;
  }

  .inbox-top-tab-menu {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 0.25rem;
    min-width: 160px;
    padding: 0.35rem;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .inbox-top-tab-menu-item {
    display: block;
    width: 100%;
    padding: 0.4rem 0.65rem;
    border: none;
    background: none;
    color: var(--text-primary);
    font-size: 0.8125rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    border-radius: 6px;
    text-align: left;
    transition: background-color 0.15s ease;
  }

  .inbox-top-tab-menu-item:hover,
  .inbox-top-tab-menu-item.active {
    background: var(--gray-100);
  }

  .inbox-top-tab-menu-empty {
    cursor: default;
    color: var(--text-secondary);
    font-style: italic;
  }

  .inbox-chats-header {
    flex-shrink: 0;
    padding: 0.6rem 1rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .inbox-chats-title {
    font-size: 0.9375rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .inbox-chats-sort {
    display: flex;
    gap: 0.25rem;
  }

  .inbox-chats-actions {
    flex-shrink: 0;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--border);
  }

  .btn-inbox-create-room-top {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    border: none;
    background: var(--green-600);
    color: var(--white);
    font-size: 0.8125rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    width: 100%;
    justify-content: center;
    transition: background-color 0.15s ease;
  }

  .btn-inbox-create-room-top:hover {
    background: var(--green-700);
  }

  .inbox-chats-search-wrap {
    flex-shrink: 0;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--border);
  }

  .inbox-chats-search-wrap .inbox-search {
    width: 100%;
  }

  .inbox-page-placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    overflow-y: auto;
  }

  .inbox-placeholder-content {
    max-width: 420px;
    text-align: center;
  }

  .inbox-placeholder-title {
    margin: 0 0 0.75rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .inbox-placeholder-desc {
    margin: 0 0 1.25rem;
    font-size: 0.9375rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .inbox-placeholder-cta {
    padding: 0.6rem 1.25rem;
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

  .inbox-placeholder-cta:hover {
    background: var(--green-700);
  }

  .inbox-page-incoming-calls {
    width: 100%;
    max-width: 560px;
    text-align: left;
  }

  .inbox-page-title {
    margin: 0 0 0.35rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
  }

  .inbox-page-desc {
    margin: 0 0 1.25rem;
    font-size: 0.9375rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }

  .inbox-calls-list {
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--card-bg);
    min-height: 200px;
  }

  .inbox-calls-empty {
    padding: 2.5rem 1.5rem;
    text-align: center;
  }

  .inbox-calls-empty-icon {
    font-size: 2rem;
    display: block;
    margin-bottom: 0.75rem;
  }

  .inbox-calls-empty-title {
    margin: 0 0 0.35rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .inbox-calls-empty-desc {
    margin: 0;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  /* Two-pane Inbox (respond.io style) */
  .view-inbox-twopane {
    flex: 1;
    display: flex;
    flex-direction: row;
    min-width: 0;
    overflow: hidden;
  }

  .inbox-pane {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }

  .inbox-pane-list {
    width: 300px;
    min-width: 300px;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    background: var(--gray-50, #f8fafc);
  }

  .inbox-pane-chat {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .context-bar {
    flex-shrink: 0;
    width: 48px;
    min-width: 48px;
    border-left: 1px solid var(--border);
    background: var(--bg-secondary);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.5rem 0;
    transition: width 0.2s ease, min-width 0.2s ease;
  }

  .context-bar.expanded {
    width: 280px;
    min-width: 280px;
    align-items: stretch;
    padding: 1rem;
  }

  .context-bar-toggle {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .context-bar-toggle:hover {
    background: var(--gray-100);
    color: var(--text-primary);
  }

  .context-bar.expanded .context-bar-toggle {
    transform: rotate(180deg);
    align-self: flex-end;
  }

  .context-bar-content {
    margin-top: 0.75rem;
    flex: 1;
    min-width: 0;
  }

  .context-bar-title {
    margin: 0 0 0.5rem;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-secondary);
  }

  .context-bar-room {
    margin: 0 0 0.35rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .context-bar-desc {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .context-bar-empty {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .context-bar-meta {
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .context-bar-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-secondary);
  }

  .context-bar-input,
  .context-bar-select {
    width: 100%;
    padding: 0.4rem 0.5rem;
    font-size: 0.8125rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg-primary);
    color: var(--text-primary);
  }

  .context-bar-select {
    cursor: pointer;
  }

  .context-bar-assigned-display {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8125rem;
    color: var(--text-primary);
  }

  .context-bar-agent-badge {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    background: var(--gray-200);
    color: var(--text-secondary);
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
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: 100%;
  }

  .view-inbox-twopane .view-chat > :global(*) {
    flex: 1 1 0%;
    min-height: 0;
    min-width: 0;
    height: 100%;
  }

  /* Message input bar: fixed at bottom of viewport, only over chat pane (always visible) */
  .chat-input-bar-module {
    position: fixed;
    bottom: 0;
    left: 364px;
    right: 48px;
    z-index: 9999;
    padding: 0.75rem 1rem;
    background: var(--bg-primary);
    border-top: 1px solid var(--border);
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.08);
  }

  .layout-context-expanded .chat-input-bar-module {
    right: 280px;
  }

  .chat-input-bar-inner {
    display: flex;
    align-items: flex-end;
    gap: 0.75rem;
    max-width: 800px;
    margin: 0 auto;
  }

  .chat-input-bar-textarea {
    flex: 1;
    min-height: 44px;
    padding: 0.6rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    font-size: 0.9375rem;
    font-family: inherit;
    resize: none;
    background: var(--card-bg);
    color: var(--text-primary);
  }

  .chat-input-bar-textarea:focus {
    outline: none;
    border-color: var(--green-600);
  }

  .chat-input-bar-send {
    flex-shrink: 0;
    min-height: 44px;
    padding: 0.6rem 1.25rem;
    border: none;
    border-radius: 10px;
    background: var(--green-600);
    color: var(--white);
    font-size: 0.9375rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .chat-input-bar-send:hover:not(:disabled) {
    background: var(--green-700);
  }

  .chat-input-bar-send:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .chat-input-bar-ai {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--card-bg);
    color: var(--text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
  }

  .chat-input-bar-ai:hover:not(:disabled) {
    color: var(--green-600);
    border-color: var(--green-400);
    background: var(--green-50);
  }

  .chat-input-bar-ai:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .chat-input-bar-ai-icon {
    display: block;
  }

  .chat-input-bar-ai-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--border);
    border-top-color: var(--green-600);
    border-radius: 50%;
    animation: chat-ai-spin 0.7s linear infinite;
  }

  @keyframes chat-ai-spin {
    to { transform: rotate(360deg); }
  }

  .respondio-inbox-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }

  .organizer-top {
    padding: 0.5rem 0.75rem;
  }

  .organizer-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }

  .organizer-filter {
    padding: 0.3rem 0.5rem;
    font-size: 0.75rem;
  }

  .organizer-topbar {
    margin-top: 0.35rem;
  }

  .organizer-section-label {
    margin: 0.5rem 0 0.25rem;
    padding: 0 0.75rem;
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
  }

  .organizer-ai-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .organizer-ai-icon {
    color: var(--accent, var(--green-600));
    flex-shrink: 0;
  }

  .lifecycle-emoji {
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .teams-label {
    margin-top: 0.75rem;
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
    background: var(--gray-100);
  }

  .inbox-conv-row.selected {
    background: var(--navy-50);
    border-left: 4px solid var(--accent, var(--green-600));
  }

  .inbox-conv-avatar-wrap {
    position: relative;
    flex-shrink: 0;
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

  .inbox-conv-avatar-dot {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--gray-400);
    border: 2px solid var(--gray-50);
  }

  .inbox-conv-avatar-dot.online {
    background: var(--green-500);
  }

  .inbox-conv-channel-overlay {
    position: absolute;
    bottom: -2px;
    right: -2px;
    width: 16px;
    height: 16px;
    border-radius: 4px;
    background: var(--card-bg);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--gray-600);
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
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .inbox-conv-direction {
    flex-shrink: 0;
    font-size: 0.75rem;
    color: var(--gray-500);
  }

  .inbox-conv-tag {
    display: inline-block;
    margin-top: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
  }

  .inbox-conv-tag.status-new-lead {
    color: var(--blue-700, #1d4ed8);
    background: var(--blue-100, #dbeafe);
  }

  .inbox-conv-tag.status-hot-lead {
    color: var(--orange-700, #c2410c);
    background: var(--orange-100, #ffedd5);
  }

  .inbox-conv-tag.status-member {
    color: var(--green-700);
    background: var(--green-100);
  }

  .inbox-conv-tag.status-payment {
    color: var(--purple-700, #6d28d9);
    background: var(--purple-100, #ede9fe);
  }

  .inbox-conv-tag.status-customer {
    color: var(--green-700, #15803d);
    background: var(--green-100, #dcfce7);
  }

  .inbox-cat-no-teams {
    font-style: italic;
    color: var(--text-secondary);
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

  .header-profile-user-info {
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .header-profile-user-name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.9375rem;
  }

  .header-profile-user-email {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .header-profile-badges {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.375rem;
  }

  .header-profile-badge {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    border-radius: 4px;
  }

  .badge-customer {
    background: var(--blue-100, #dbeafe);
    color: var(--blue-700, #1d4ed8);
  }

  .badge-business {
    background: var(--purple-100, #f3e8ff);
    color: var(--purple-700, #7e22ce);
  }

  .header-profile-divider {
    height: 1px;
    background: var(--border);
    margin: 0.375rem 0;
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

  .notification-message-btn {
    flex: 1;
    min-width: 0;
    display: block;
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    text-align: left;
    font: inherit;
    color: inherit;
    cursor: pointer;
  }

  .notification-message {
    display: block;
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
