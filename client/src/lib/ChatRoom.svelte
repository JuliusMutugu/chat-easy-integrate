<script>
  import { onMount, onDestroy } from "svelte";
  import { playClick, playSuccess, getEnterToSend, getCustomSnippets, getAvatar, agentAssignValue, getAssignedToDisplay, getWorkflowConfig, safeParseJson } from "./theme.js";
  import DealPanel from "./DealPanel.svelte";
  import Calculator from "./Calculator.svelte";

  export let socket = null;
  export let config = {};
  export let room = {};
  export let onLeaveRoom = () => {};
  /** Called after assigning/unassigning so parent can update currentRoom and rooms */
  export let onRoomMetaChange = () => {};
  /** When set, parent renders the message input bar; we use this for draft and expose send via getSendMessage */
  export let messageDraft = undefined;
  export let getSendMessage = undefined;

  let messages = [];
  let newMessage = "";
  let users = [];
  let userCount = 0;
  let isNegotiationActive = false;
  let currentNegotiation = null;
  let showNegotiationForm = false;
  let negotiationProposal = "";
  let messagesContainer;
  let typingUsers = [];
  let typingTimeout;
  let replyingTo = null;
  let mentionShow = false;
  let mentionQuery = "";
  let messageInputEl;
  let mentionListEl;
  let showQuickReplies = false;
  let showCustomSnippets = false;
  let snippetShow = false;
  let snippetQuery = "";
  let emojiShow = false;
  let emojiQuery = "";
  let showEmojiPicker = false;
  let variableShow = false;
  let variableQuery = "";
  let emailSending = false;
  let emailError = "";
  let greetingDismissed = false;
  let showDealPanel = false;
  let showCalculator = false;
  let showMembersList = false;
  let showInvitePanel = false;
  let showAssignPanel = false;
  let showRoomSettings = false;
  let settingsKicking = false;
  let inviteLinkValue = "";
  let inviteEmail = "";
  let assignInProgress = false;
  let showPaymentPanel = false;
  let showSignPanel = false;
  let showRedlinePanel = false;
  let redlineMessage = null;
  let redlineSuggested = "";
  let paymentAmount = "";
  let paymentCurrency = "KES";
  let signatureDataUrl = "";
  let signCanvasEl;
  let signDrawing = false;
  let signLastX = 0;
  let signLastY = 0;
  let fileInputEl;
  let uploadInProgress = false;
  let widgetEmbedCode = "";
  let widgetCreating = false;
  let widgets = [];

  async function createWidget() {
    if (widgetCreating || !room.id) return;
    widgetCreating = true;
    try {
      const res = await fetch(`${config.serverUrl}/api/widget/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ roomId: room.id, allowedOrigins: "*" }),
      });
      const data = await safeParseJson(res) || {};
      if (!res.ok) throw new Error(data.error || "Failed to create widget");
      widgetEmbedCode = data.embedCode || "";
      widgets = [data, ...widgets];
      playSuccess();
    } catch (err) {
      showToast(err.message || "Failed to create widget");
    } finally {
      widgetCreating = false;
    }
  }

  async function loadWidgets() {
    if (!room.id) return;
    try {
      const res = await fetch(`${config.serverUrl}/api/widget/list/${room.id}`, { credentials: "include" });
      if (!res.ok) return;
      const data = await safeParseJson(res);
      widgets = (data?.widgets && Array.isArray(data.widgets)) ? data.widgets : [];
      if (widgets.length > 0 && !widgetEmbedCode) {
        widgetEmbedCode = widgets[0].embedCode || "";
      }
    } catch (_) {}
  }

  function copyWidgetCode(code) {
    const c = code || widgetEmbedCode;
    if (!c) return;
    navigator.clipboard.writeText(c).then(() => {
      showToast("Embed code copied.");
      playSuccess();
    });
  }

  async function ensureInviteLink() {
    if (room.inviteToken) {
      inviteLinkValue = typeof window !== "undefined" ? `${window.location.origin}?invite=${room.inviteToken}` : "";
      return;
    }
    try {
      const res = await fetch(`${config.serverUrl}/api/rooms/${room.id}`, {
        credentials: "include",
      });
      if (res.ok) {
        const r = await safeParseJson(res);
        if (r?.inviteToken) {
          room.inviteToken = r.inviteToken;
          room.code = r.code;
          inviteLinkValue = typeof window !== "undefined" ? `${window.location.origin}?invite=${r.inviteToken}` : "";
        }
      }
    } catch (_) {}
  }

  async function openInvitePanel() {
    showInvitePanel = true;
    loadWidgets();
    inviteLinkValue = "";
    await ensureInviteLink();
    playClick();
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast-notification";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add("show"), 100);
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  }

  async function toggleRoomStatus() {
    const newStatus = room.status === "active" ? "inactive" : "active";
    try {
      const res = await fetch(`${config.serverUrl}/api/rooms/${room.id}/meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        room.status = newStatus;
        playSuccess();
        showToast(`Room ${newStatus === "active" ? "activated" : "deactivated"}`);
        if (typeof onRoomMetaChange === "function") onRoomMetaChange();
      }
    } catch (e) {
      showToast("Failed to update room status");
    }
  }

  async function kickUser(username) {
    if (!confirm(`Kick ${username} from this room?`)) return;
    settingsKicking = true;
    try {
      const res = await fetch(`${config.serverUrl}/api/rooms/${room.id}/kick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username }),
      });
      const data = await safeParseJson(res) || {};
      if (!res.ok) throw new Error(data.error || "Failed to kick user");
      users = users.filter(u => u !== username);
      userCount = users.length;
      playSuccess();
      showToast(`${username} has been kicked`);
    } catch (e) {
      showToast(e.message || "Failed to kick user");
    } finally {
      settingsKicking = false;
    }
  }

  function copyInviteLink() {
    if (inviteLinkValue) {
      navigator.clipboard.writeText(inviteLinkValue);
      playSuccess();
      showToast("Invite link copied.");
    }
  }

  function copyRoomCode() {
    if (room.code) {
      navigator.clipboard.writeText(String(room.code));
      playSuccess();
      showToast("Room code copied.");
    }
  }

  async function generateNewInviteLink() {
    try {
      const res = await fetch(`${config.serverUrl}/api/rooms/${room.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ invitedBy: config.username }),
      });
      if (res.ok) {
        const data = await safeParseJson(res);
        if (data?.inviteToken) {
          room.inviteToken = data.inviteToken;
          inviteLinkValue = typeof window !== "undefined" ? `${window.location.origin}?invite=${data.inviteToken}` : "";
          playSuccess();
          showToast("New invite link generated.");
        }
      }
    } catch (_) {}
  }

  async function sendEmailInvite() {
    if (!inviteEmail.trim() || !inviteLinkValue) return;
    emailError = "";
    emailSending = true;
    try {
      const res = await fetch(`${config.serverUrl}/api/rooms/${room.id}/invite/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ to: inviteEmail.trim() }),
      });
      const data = await safeParseJson(res) || {};
      if (!res.ok) {
        emailError = data.error || "Failed to send email";
        return;
      }
      inviteEmail = "";
      playSuccess();
      showToast("Invitation email sent.");
    } catch (e) {
      emailError = e.message || "Network error";
    } finally {
      emailSending = false;
    }
  }

  async function assignTo(usernameOrAgentValue) {
    if (assignInProgress || !config.serverUrl || !room.id) return;
    assignInProgress = true;
    showAssignPanel = false;
    try {
      const res = await fetch(`${config.serverUrl}/api/rooms/${room.id}/meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ assignedTo: usernameOrAgentValue || null }),
      });
      if (!res.ok) return;
      const updated = await safeParseJson(res);
      if (!updated) return;
      onRoomMetaChange(updated);
      // When assigning to an agent, sync that agent's workflow config to the server so auto-reply works with no extra clicks
      if (usernameOrAgentValue && String(usernameOrAgentValue).startsWith("agent:")) {
        const template = String(usernameOrAgentValue).slice(6).trim();
        const workflow = getWorkflowConfig(template);
        if (workflow) {
          try {
            await fetch(`${config.serverUrl}/api/workflows/${template}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                product: workflow.product ?? "",
                kpis: workflow.kpis ?? "",
                instructions: workflow.instructions ?? "",
                websiteText: workflow.websiteText ?? "",
                documentText: workflow.documentText ?? "",
              }),
            });
          } catch (_) {}
        }
      }
      playSuccess();
      const label = usernameOrAgentValue ? getAssignedToDisplay(usernameOrAgentValue) : null;
      showToast(label ? "Assigned to " + label + ". The agent will reply automatically to new messages." : "Unassigned.");
    } catch (_) {
      showToast("Failed to update assignment.");
    } finally {
      assignInProgress = false;
    }
  }

  function assignToAgent(templateKey) {
    const value = agentAssignValue(templateKey);
    if (value) assignTo(value);
  }

  function copySimpleMessage() {
    const text = `Join "${room.name}" - Room Code: ${room.code ?? ""}`;
    navigator.clipboard.writeText(text);
    playSuccess();
    showToast("Message copied.");
  }

  function copyDetailedMessage() {
    const text = `You're invited to "${room.name}". Code: ${room.code ?? ""}. Link: ${inviteLinkValue}. ${room.description ?? ""}`;
    navigator.clipboard.writeText(text);
    playSuccess();
    showToast("Detailed message copied.");
  }

  function openSuggestEdit(msg) {
    redlineMessage = msg;
    redlineSuggested = msg.message || "";
    showRedlinePanel = true;
    playClick();
  }

  function sendRedline() {
    if (!socket || !redlineMessage || !redlineSuggested.trim()) return;
    socket.emit("send-message", {
      message: "Suggested edit",
      type: "redline",
      payload: { original: redlineMessage.message, suggested: redlineSuggested.trim() },
    });
    showRedlinePanel = false;
    redlineMessage = null;
    redlineSuggested = "";
    playSuccess();
  }

  function sendPaymentRequest() {
    if (!socket || !paymentAmount.trim()) return;
    const amount = parseFloat(paymentAmount) || 0;
    socket.emit("send-message", {
      message: "Payment request",
      type: "payment_request",
      payload: { amount, currency: paymentCurrency, gateway: "stub", reference: "PAY-" + Date.now() },
    });
    showPaymentPanel = false;
    paymentAmount = "";
    paymentCurrency = "KES";
    playSuccess();
  }

  function openSignPanel() {
    signatureDataUrl = "";
    showSignPanel = true;
    playClick();
  }

  function captureSignature() {
    if (!signCanvasEl) return;
    signatureDataUrl = signCanvasEl.toDataURL("image/png");
    playSuccess();
  }

  function signStart(e) {
    if (!signCanvasEl) return;
    signDrawing = true;
    const rect = signCanvasEl.getBoundingClientRect();
    signLastX = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    signLastY = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
  }

  function signMove(e) {
    if (!signDrawing || !signCanvasEl) return;
    e.preventDefault();
    const rect = signCanvasEl.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    const ctx = signCanvasEl.getContext("2d");
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(signLastX, signLastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    signLastX = x;
    signLastY = y;
  }

  function signEnd() {
    signDrawing = false;
  }

  function sendSignature() {
    if (!socket || !signatureDataUrl) return;
    socket.emit("send-message", {
      message: "Signature",
      type: "signature",
      payload: { imageUrl: signatureDataUrl, label: "Signed" },
    });
    showSignPanel = false;
    signatureDataUrl = "";
    playSuccess();
  }

  function openInvoice() {
    const url = `${config.serverUrl}/api/rooms/${room.id}/invoice?reference=INV-${Date.now()}`;
    window.open(url, "_blank");
    playClick();
  }

  const QUICK_REPLIES = [
    "Yes",
    "No",
    "Thanks",
    "I'll get back to you",
    "Let me check",
    "Agreed",
    "Noted",
    "On it",
    "Can we discuss?",
  ];

  let currentRoomId = room.id;

  // Clear messages and rejoin when room changes
  $: if (room.id !== currentRoomId) {
    currentRoomId = room.id;
    messages = [];
    users = [];
    userCount = 0;
    if (socket) {
      removeSocketListeners();
      joinRoom();
      setupSocketListeners();
    }
  }

  onMount(() => {
    if (socket) {
      joinRoom();
      setupSocketListeners();
    }
    if (typeof getSendMessage === "function") {
      getSendMessage(sendMessage);
    }
  });

  onDestroy(() => {
    if (socket) {
      removeSocketListeners();
    }
  });

  /* Room isolation: this component is keyed by room.id so switching rooms remounts
     and clears all state. Messages and events are scoped to this room only. */

  function joinRoom() {
    socket.emit("join-room", {
      roomId: room.id,
      username: config.username,
    });
  }

  function setupSocketListeners() {
    socket.on("message-history", (history) => {
      messages = history;
      scrollToBottom();
    });

    socket.on("new-message", (message) => {
      const hasClientId = message.clientId != null;
      if (hasClientId) {
        const idx = messages.findIndex((m) => m.clientId === message.clientId);
        if (idx !== -1) {
          messages = messages.slice(0, idx).concat([{ ...message, status: "sent" }]).concat(messages.slice(idx + 1));
          scrollToBottom();
          return;
        }
      }
      messages = [...messages, { ...message, status: "sent" }];
      scrollToBottom();
    });

    socket.on("user-joined", (data) => {
      const systemMessage = {
        id: Date.now(),
        type: "system",
        message: `${data.username} joined the room`,
        timestamp: new Date(),
      };
      messages = [...messages, systemMessage];
      scrollToBottom();
    });

    socket.on("user-left", (data) => {
      const systemMessage = {
        id: Date.now(),
        type: "system",
        message: `${data.username} left the room`,
        timestamp: new Date(),
      };
      messages = [...messages, systemMessage];
      scrollToBottom();
    });

    socket.on("room-update", (data) => {
      users = data.users || [];
      userCount = data.userCount || 0;
    });

    socket.on("negotiation-started", (data) => {
      isNegotiationActive = true;
      currentNegotiation = {
        proposer: data.proposer,
        proposal: data.proposal,
        proposalId: data.proposalId,
        votes: new Map(),
        hasVoted: false,
      };

      const systemMessage = {
        id: Date.now(),
        type: "negotiation-start",
        message: `${data.proposer} started a negotiation: "${data.proposal}"`,
        timestamp: new Date(),
      };
      messages = [...messages, systemMessage];
      scrollToBottom();
    });

    socket.on("vote-cast", (data) => {
      if (currentNegotiation) {
        currentNegotiation.votes.set(data.username, data.vote);

        const systemMessage = {
          id: Date.now(),
          type: "vote",
          message: `${data.username} voted ${data.vote}`,
          timestamp: new Date(),
        };
        messages = [...messages, systemMessage];
        scrollToBottom();
      }
    });

    socket.on("negotiation-completed", (data) => {
      isNegotiationActive = false;

      const systemMessage = {
        id: Date.now(),
        type: "negotiation-end",
        message: `Negotiation ${data.result}. Votes: ${data.votes.approve} approve, ${data.votes.reject} reject`,
        timestamp: new Date(),
      };
      messages = [...messages, systemMessage];
      currentNegotiation = null;
      scrollToBottom();
    });

    socket.on("user-typing", (data) => {
      if (data.username !== config.username) {
        typingUsers = [
          ...typingUsers.filter((u) => u !== data.username),
          data.username,
        ];
      }
    });

    socket.on("user-stop-typing", (data) => {
      typingUsers = typingUsers.filter((u) => u !== data.username);
    });

    socket.on("removed-from-room", () => {
      onLeaveRoom();
    });
  }

  function removeSocketListeners() {
    socket.off("message-history");
    socket.off("new-message");
    socket.off("user-joined");
    socket.off("user-left");
    socket.off("room-update");
    socket.off("negotiation-started");
    socket.off("vote-cast");
    socket.off("negotiation-completed");
    socket.off("removed-from-room");
  }

  function removeMember(username) {
    if (!socket || room.createdByUsername !== config.username || username === config.username) return;
    socket.emit("remove-member", { roomId: room.id, targetUsername: username });
  }

  function sendMessage() {
    const text = (typeof messageDraft !== "undefined" && messageDraft != null ? messageDraft : newMessage).trim();
    if (!text || !socket) return;

    const clientId = "c-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
    const pending = {
      id: "pending-" + clientId,
      clientId,
      username: config.username,
      message: text,
      type: "text",
      status: "pending",
      timestamp: new Date(),
    };
    messages = [...messages, pending];

    const payload = {
      message: text,
      type: "text",
      clientId,
    };
    if (replyingTo) {
      payload.replyToMessageId = replyingTo.id;
    }
    socket.emit("send-message", payload);

    playClick();
    if (typeof messageDraft !== "undefined" && messageDraft != null) {
      messageDraft = "";
    } else {
      newMessage = "";
    }
    replyingTo = null;
    mentionShow = false;
    snippetShow = false;
    emojiShow = false;
    variableShow = false;
    showQuickReplies = false;
    showCustomSnippets = false;
  }

  function sendDealTerms(terms) {
    if (!socket) return;
    const clientId = "c-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
    const pending = {
      id: "pending-" + clientId,
      clientId,
      username: config.username,
      message: "Deal terms",
      type: "deal_terms",
      payload: terms,
      status: "pending",
      timestamp: new Date(),
    };
    messages = [...messages, pending];
    socket.emit("send-message", {
      message: "Deal terms",
      type: "deal_terms",
      payload: terms,
      clientId,
    });
    playClick();
  }

  function cancelReply() {
    replyingTo = null;
  }

  function replyToMessage(message) {
    if (message.type !== "text") return;
    const snippet = message.message.length > 60 ? message.message.slice(0, 60) + "..." : message.message;
    replyingTo = { id: message.id, username: message.username, snippet };
  }

  function getMessageById(id) {
    return messages.find((m) => m.id === id);
  }

  function getAvatarLetter(username) {
    if (!username || typeof username !== "string") return "?";
    const letter = username.trim().charAt(0).toUpperCase();
    return letter || "?";
  }

  function getAvatarType(username) {
    if (username !== config.username) return null;
    return getAvatar() || null;
  }

  function handleMessageInput() {
    const text = newMessage;
    const lastAt = text.lastIndexOf("@");
    const lastSlash = text.lastIndexOf("/");
    const lastColon = text.lastIndexOf(":");
    const cursorPos = messageInputEl ? messageInputEl.selectionStart : text.length;

    mentionShow = false;
    snippetShow = false;
    emojiShow = false;
    variableShow = false;

    const lastDollar = text.lastIndexOf("$");
    if (lastDollar !== -1 && (cursorPos === undefined || cursorPos >= lastDollar)) {
      const afterDollar = text.slice(lastDollar + 1);
      if (afterDollar.indexOf("\n") === -1 && !/^\s*\{\{/.test(afterDollar)) {
        variableShow = true;
        variableQuery = afterDollar.replace(/\{\{/g, "").replace(/\}\}/g, "").trim().toLowerCase();
      }
    }
    if (lastAt !== -1) {
      const afterAt = text.slice(lastAt + 1);
      if (!/\s/.test(afterAt) && (cursorPos === undefined || cursorPos >= lastAt)) {
        mentionShow = true;
        mentionQuery = afterAt.toLowerCase();
      }
    }
    if (lastSlash !== -1 && (cursorPos === undefined || cursorPos >= lastSlash)) {
      const afterSlash = text.slice(lastSlash + 1);
      if (!/\s/.test(afterSlash) && afterSlash.indexOf("\n") === -1) {
        snippetShow = true;
        snippetQuery = afterSlash.toLowerCase();
      }
    }
    if (lastColon !== -1 && (cursorPos === undefined || cursorPos >= lastColon)) {
      const afterColon = text.slice(lastColon + 1);
      if (!/\s/.test(afterColon) && afterColon.indexOf("\n") === -1) {
        emojiShow = true;
        emojiQuery = afterColon.toLowerCase();
      }
    }
  }

  $: mentionCandidates = users.filter(
    (u) =>
      u !== config.username &&
      (!mentionQuery || u.toLowerCase().startsWith(mentionQuery))
  );

  function insertMention(username) {
    const lastAt = newMessage.lastIndexOf("@");
    newMessage = newMessage.slice(0, lastAt) + "@" + username + " ";
    mentionShow = false;
    mentionQuery = "";
  }

  const EMOJI_SHORTCODES = [
    { code: "smile", char: "😊" },
    { code: "grin", char: "😁" },
    { code: "heart", char: "❤️" },
    { code: "thumbsup", char: "👍" },
    { code: "thumbsdown", char: "👎" },
    { code: "ok", char: "👌" },
    { code: "wave", char: "👋" },
    { code: "clap", char: "👏" },
    { code: "check", char: "✅" },
    { code: "x", char: "❌" },
    { code: "fire", char: "🔥" },
    { code: "star", char: "⭐" },
    { code: "eyes", char: "👀" },
    { code: "thinking", char: "🤔" },
    { code: "cool", char: "😎" },
    { code: "sad", char: "😢" },
    { code: "laugh", char: "😂" },
    { code: "party", char: "🎉" },
    { code: "rocket", char: "🚀" },
  ];

  $: snippetCandidates = (() => {
    if (!snippetShow) return [];
    const custom = getCustomSnippets();
    const q = snippetQuery.toLowerCase();
    const byName = custom.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.body || "").toLowerCase().includes(q)
    );
    const byQuick = QUICK_REPLIES.filter((t) => t.toLowerCase().includes(q));
    const snippetItems = byName.map((s) => ({ type: "snippet", name: s.name, body: s.body }));
    const quickItems = byQuick.map((t) => ({ type: "quick", name: t, body: t }));
    return [...snippetItems, ...quickItems].slice(0, 8);
  })();

  $: emojiCandidates = emojiShow
    ? EMOJI_SHORTCODES.filter(
        (e) => !emojiQuery || e.code.toLowerCase().startsWith(emojiQuery)
      ).slice(0, 8)
    : [];

  const VARIABLE_OPTIONS = [
    { key: "contact.name", template: "{{contact.name}}" },
    { key: "contact.email", template: "{{contact.email}}" },
    { key: "contact.phone", template: "{{contact.phone}}" },
    { key: "room.name", template: "{{room.name}}" },
    { key: "agent.name", template: "{{agent.name}}" },
    { key: "date", template: "{{date}}" },
    { key: "time", template: "{{time}}" },
  ];

  $: variableCandidates = variableShow
    ? VARIABLE_OPTIONS.filter(
        (v) => !variableQuery || v.key.toLowerCase().includes(variableQuery)
      ).slice(0, 8)
    : [];

  function insertVariableAtDollar(template) {
    const lastDollar = newMessage.lastIndexOf("$");
    newMessage = newMessage.slice(0, lastDollar) + template + " ";
    variableShow = false;
    variableQuery = "";
    playClick();
  }

  function insertSnippetAtSlash(body) {
    const lastSlash = newMessage.lastIndexOf("/");
    newMessage = newMessage.slice(0, lastSlash) + body + " ";
    snippetShow = false;
    snippetQuery = "";
    showQuickReplies = false;
    showCustomSnippets = false;
    playClick();
  }

  function insertEmojiAtColon(char) {
    const lastColon = newMessage.lastIndexOf(":");
    newMessage = newMessage.slice(0, lastColon) + char + " ";
    emojiShow = false;
    emojiQuery = "";
    playClick();
  }

  function insertEmojiFromPicker(char) {
    newMessage = newMessage + char;
    showEmojiPicker = false;
    playClick();
  }

  function formatMessageBody(text) {
    const str = typeof text === "string" ? text : (text != null ? String(text) : "");
    const parts = [];
    let lastIndex = 0;
    const mentionRegex = /@(\S+)/g;
    let m;
    while ((m = mentionRegex.exec(str)) !== null) {
      parts.push({ type: "text", value: str.slice(lastIndex, m.index) });
      parts.push({ type: "mention", value: m[1], full: m[0] });
      lastIndex = m.index + m[0].length;
    }
    parts.push({ type: "text", value: str.slice(lastIndex) });
    return parts;
  }

  async function shareLocation() {
    if (!socket) return;

    if (!navigator.geolocation) {
      alert("Geolocation is not supported by this browser.");
      return;
    }

    try {
      const loadingMessage = {
        id: Date.now(),
        username: config.username,
        message: "Sharing location...",
        type: "location-loading",
        timestamp: new Date(),
      };
      messages = [...messages, loadingMessage];
      scrollToBottom();

      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;

      messages = messages.filter((m) => m.id !== loadingMessage.id);

      socket.emit("send-message", {
        message: "Live location shared",
        type: "location",
        location: {
          latitude,
          longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      messages = messages.filter((m) => m.type !== "location-loading");

      if (error.code === error.PERMISSION_DENIED) {
        alert("Location access denied. Please allow location to share.");
      } else if (error.code === error.POSITION_UNAVAILABLE) {
        alert("Location information is unavailable.");
      } else if (error.code === error.TIMEOUT) {
        alert("Location request timed out.");
      } else {
        alert("An error occurred while retrieving your location.");
      }
    }
  }

  function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      });
    });
  }

  function openLocationInMaps(latitude, longitude) {
    const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
    const appleMapsUrl = `https://maps.apple.com/?q=${latitude},${longitude}`;
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes("iphone") || userAgent.includes("ipad")) {
      window.open(appleMapsUrl, "_blank");
    } else {
      window.open(googleMapsUrl, "_blank");
    }
  }

  function handleInputKeydown(event) {
    if (event.key === "Escape") {
      if (mentionShow) {
        mentionShow = false;
        event.preventDefault();
      }
      if (snippetShow) {
        snippetShow = false;
        event.preventDefault();
      }
      if (emojiShow) {
        emojiShow = false;
        event.preventDefault();
      }
      if (showEmojiPicker) {
        showEmojiPicker = false;
        event.preventDefault();
      }
      if (variableShow) {
        variableShow = false;
        event.preventDefault();
      }
    }
  }

  function handleKeyPress(event) {
    const enterToSend = getEnterToSend();
    const isEnter = event.key === "Enter";
    const isCtrlEnter = event.ctrlKey && isEnter;

    if (mentionShow && mentionCandidates.length > 0 && isEnter) return;
    if (snippetShow && snippetCandidates.length > 0 && isEnter) return;
    if (emojiShow && emojiCandidates.length > 0 && isEnter) return;
    if (variableShow && variableCandidates.length > 0 && isEnter) return;

    if (enterToSend) {
      if (isEnter && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
        return;
      }
    } else {
      if (isCtrlEnter) {
        event.preventDefault();
        sendMessage();
        return;
      }
    }

    if (socket && newMessage.trim()) {
      socket.emit("typing", { roomId: room.id, username: config.username });
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        socket.emit("stop-typing", {
          roomId: room.id,
          username: config.username,
        });
      }, 1000);
    }
  }

  function startNegotiation() {
    if (!negotiationProposal.trim() || !socket) return;

    socket.emit("start-negotiation", {
      proposal: negotiationProposal.trim(),
    });

    playSuccess();
    negotiationProposal = "";
    showNegotiationForm = false;
  }

  function vote(voteType) {
    if (!currentNegotiation || currentNegotiation.hasVoted || !socket) return;

    socket.emit("vote", {
      proposalId: currentNegotiation.proposalId,
      vote: voteType,
    });

    currentNegotiation.hasVoted = true;
  }

  function scrollToBottom() {
    setTimeout(() => {
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 100);
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDealVal(v) {
    if (v == null) return "—";
    if (typeof v === "number") return v.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return v;
  }

  function getMessageClass(message) {
    if (message.type === "system") return "system-message";
    if (message.type === "negotiation-start") return "negotiation-message";
    if (message.type === "negotiation-end") return "negotiation-end-message";
    if (message.type === "vote") return "vote-message";
    if (message.type === "deal_terms") return "deal-terms-message " + (message.username === config.username ? "own-message" : "other-message");
    if (message.username === config.username) return "own-message";
    return "other-message";
  }

  function insertQuickReply(text) {
    newMessage = newMessage ? newMessage + " " + text : text;
    showQuickReplies = false;
  }

  function insertCustomSnippet(body) {
    newMessage = newMessage ? newMessage + " " + body : body;
    showCustomSnippets = false;
    playClick();
  }

  function insertResultFromCalculator(value) {
    newMessage = newMessage ? newMessage + " " + value : value;
    showCalculator = false;
    playClick();
  }

  async function onFileSelected(e) {
    const file = e.target.files?.[0];
    if (!file || !socket || !config.serverUrl) return;
    uploadInProgress = true;
    playClick();
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${config.serverUrl}/api/rooms/${room.id}/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      const { url, filename } = await res.json();
      const clientId = "c-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
      const pending = {
        id: "pending-" + clientId,
        clientId,
        username: config.username,
        message: filename,
        type: "document",
        documentUrl: url,
        status: "pending",
        timestamp: new Date(),
      };
      messages = [...messages, pending];
      socket.emit("send-message", {
        message: filename,
        type: "document",
        payload: { url, filename },
        clientId,
      });
      playSuccess();
    } catch (err) {
      alert("Failed to upload document. Please try again.");
    } finally {
      uploadInProgress = false;
      e.target.value = "";
    }
  }

  $: negotiationVoteCounts = currentNegotiation
    ? (() => {
        const v = [...currentNegotiation.votes.values()];
        return {
          approve: v.filter((x) => x === "approve").length,
          reject: v.filter((x) => x === "reject").length,
        };
      })()
    : { approve: 0, reject: 0 };

  /** Last deal_terms message in the conversation (agreed terms). */
  $: latestDealTerms = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.type === "deal_terms" && m.payload && (m.payload.price != null || m.payload.total != null))
        return m.payload;
    }
    return null;
  })();

  /** Terms to show at top: from agreed deal terms or from active negotiation proposal. */
  $: termsSummary = latestDealTerms
    ? { type: "deal_terms", price: latestDealTerms.price, qty: latestDealTerms.qty, total: latestDealTerms.total, subtotal: latestDealTerms.subtotal }
    : currentNegotiation?.proposal
      ? { type: "negotiation", proposal: currentNegotiation.proposal }
      : null;

  function formatTermsMoney(n) {
    if (n == null || isNaN(n)) return "—";
    return new Intl.NumberFormat("en-KE", { style: "decimal", minimumFractionDigits: 2 }).format(n);
  }
</script>

<svelte:window onclick={(e) => { if (showAssignPanel && !e.target.closest('.header-assign-wrap')) showAssignPanel = false; }} />
<div class="chat-room chat-room-respondio">
  <header class="chat-header respondio-chat-header">
    <div class="header-left">
      <button type="button" class="btn-back" onclick={onLeaveRoom}>Leave</button>
      <div class="room-meta">
        <h3 class="room-name">{room.name}</h3>
        <button
          type="button"
          class="active-users-trigger"
          onclick={() => (showMembersList = !showMembersList)}
          aria-expanded={showMembersList}
          aria-label="Active users in this room"
        >
          <span class="user-count">Active users ({userCount})</span>
          <span class="active-users-chevron" aria-hidden="true">{showMembersList ? "▼" : "▶"}</span>
        </button>
        {#if showMembersList}
          <div class="members-list-wrap" role="list">
            {#each users as u}
              <div class="member-row" role="listitem">
                <span class="member-name">{u}{#if u === config.username} <span class="you-badge">(you)</span>{/if}</span>
                {#if room.createdByUsername === config.username && u !== config.username}
                  <button type="button" class="btn-remove-member" onclick={() => removeMember(u)} title="Remove from room" aria-label="Remove {u} from room">Remove</button>
                {/if}
              </div>
            {:else}
              <div class="member-row empty">No one else in the room yet.</div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
    <div class="header-date">{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
    <div class="header-actions respondio-header-actions">
      <button type="button" class="header-action-btn" onclick={() => (showMembersList = !showMembersList)} title="Contact" aria-label="Contact">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      </button>
      <button type="button" class="header-action-btn" title="History" aria-label="History">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </button>
      <button type="button" class="header-action-btn" title="Channels" aria-label="Channels">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      </button>
      <button type="button" class="header-action-btn" onclick={() => (showDealPanel = !showDealPanel)} title="CRM / Deal" aria-label="CRM">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
      </button>
    </div>
    <div class="header-right">
      {#if room.createdByUsername === config.username}
        <button type="button" class="btn-invite-header" onclick={openInvitePanel} title="Invite" aria-label="Invite to room">Invite</button>
        <button type="button" class="btn-settings-header" onclick={() => (showRoomSettings = !showRoomSettings)} title="Room settings" aria-label="Room settings">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6M1 12h6m6 0h6"/></svg>
        </button>
      {/if}
      <div class="header-assign-wrap">
        {#if room.assignedTo && room.assignedTo.startsWith && room.assignedTo.startsWith('agent:')}
          <span class="header-assigned-agent-badge" title="Assigned to agent">{getAssignedToDisplay(room.assignedTo)}</span>
        {/if}
        <button type="button" class="btn-assign-header" onclick={() => (showAssignPanel = !showAssignPanel)} title="Assign conversation" aria-expanded={showAssignPanel} aria-haspopup="true" aria-label="Assign to someone">Assign</button>
        {#if showAssignPanel}
          <div class="assign-dropdown" role="menu">
            <button type="button" class="assign-dropdown-item" role="menuitem" disabled={assignInProgress} onclick={() => assignTo(config.username)}>Assign to me</button>
            <button type="button" class="assign-dropdown-item" role="menuitem" disabled={assignInProgress} onclick={() => assignTo(null)}>Unassign</button>
            <div class="assign-dropdown-divider"></div>
            <div class="assign-dropdown-label">Assign to agent</div>
            <button type="button" class="assign-dropdown-item" role="menuitem" disabled={assignInProgress} onclick={() => assignToAgent('sales-engineer')}>Sales Engineer</button>
            <button type="button" class="assign-dropdown-item" role="menuitem" disabled={assignInProgress} onclick={() => assignToAgent('marketing-engineer')}>Marketing Engineer</button>
            <button type="button" class="assign-dropdown-item" role="menuitem" disabled={assignInProgress} onclick={() => assignToAgent('receptionist')}>Receptionist</button>
            <button type="button" class="assign-dropdown-item" role="menuitem" disabled={assignInProgress} onclick={() => assignToAgent('chat-widget')}>Chat Widget</button>
            <div class="assign-dropdown-divider"></div>
            <div class="assign-dropdown-hint">Assign to a team member (team list coming soon)</div>
          </div>
        {/if}
      </div>
      {#if !isNegotiationActive}
        <button type="button" class="btn-negotiate" onclick={() => (showNegotiationForm = !showNegotiationForm)}>Start negotiation</button>
      {:else}
        <span class="negotiation-badge">Negotiation active</span>
      {/if}
    </div>
  </header>

  {#if showInvitePanel}
    <div
      class="drawer-overlay"
      role="dialog"
      aria-label="Invite to room"
      tabindex="-1"
      onclick={(e) => e.target === e.currentTarget && (showInvitePanel = false)}
      onkeydown={(e) => e.key === "Escape" && (showInvitePanel = false)}
    >
      <div class="drawer-panel invite-drawer" role="region" aria-label="Invite panel">
        <div class="drawer-header">
          <h3 class="drawer-title">Invite to this room</h3>
          <button type="button" class="drawer-close" onclick={() => (showInvitePanel = false)} aria-label="Close">×</button>
        </div>
        <div class="drawer-body">
          <p class="invite-hint">Share the link or room code so others can join.</p>
          {#if room.code != null}
            <div class="invite-row">
              <label for="invite-room-code" class="invite-label">Room code</label>
              <div class="invite-input-row">
                <input id="invite-room-code" type="text" readonly value={room.code} class="invite-input" />
                <button type="button" class="btn-copy" onclick={copyRoomCode}>Copy code</button>
              </div>
            </div>
          {/if}
          <div class="invite-row">
            <label for="invite-link-input" class="invite-label">Direct link</label>
            <div class="invite-input-row">
              <input id="invite-link-input" type="text" readonly value={inviteLinkValue} class="invite-input" placeholder="Loading…" />
              <button type="button" class="btn-copy" onclick={copyInviteLink} disabled={!inviteLinkValue}>Copy link</button>
            </div>
            <div class="invite-extra">
              <button type="button" class="btn-generate-link" onclick={generateNewInviteLink}>Generate new link</button>
              <small>Use if the current link is compromised</small>
            </div>
          </div>

          <section class="invite-section-block">
            <h4 class="invite-section-title">Email invitation</h4>
            <p class="invite-hint small">Invitation is sent via your configured email (Integrations).</p>
            <div class="invite-email-row">
              <input
                type="email"
                bind:value={inviteEmail}
                placeholder="Enter email address"
                class="invite-email-input"
                id="invite-email-input"
                disabled={emailSending}
              />
              <button
                type="button"
                class="btn-copy btn-copy-email"
                onclick={sendEmailInvite}
                disabled={!inviteEmail.trim() || !inviteLinkValue || emailSending}
              >
                {emailSending ? "Sending…" : "Send email"}
              </button>
            </div>
            {#if emailError}
              <p class="invite-email-error" role="alert">{emailError}</p>
            {/if}
          </section>

          <section class="invite-section-block">
            <h4 class="invite-section-title">Share</h4>
            <div class="invite-share-row">
              <button
                type="button"
                class="btn-share-option"
                onclick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Join "${room.name}". Room Code: ${room.code ?? ""}. Link: ${inviteLinkValue}`)}`)}
                disabled={!inviteLinkValue}
              >
                WhatsApp
              </button>
              <button
                type="button"
                class="btn-share-option"
                onclick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(inviteLinkValue)}&text=${encodeURIComponent(`Join "${room.name}". Code: ${room.code ?? ""}`)}`)}
                disabled={!inviteLinkValue}
              >
                Telegram
              </button>
              <button
                type="button"
                class="btn-share-option"
                onclick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Join "${room.name}". Code: ${room.code ?? ""}`)}&url=${encodeURIComponent(inviteLinkValue)}`)}
                disabled={!inviteLinkValue}
              >
                Twitter
              </button>
            </div>
          </section>

          <section class="invite-section-block">
            <h4 class="invite-section-title">Embed widget</h4>
            <p class="invite-hint small">Add a chat widget to your website. Visitors can chat directly from your site.</p>
            {#if widgets.length === 0}
              <button type="button" class="btn-create-widget" onclick={createWidget} disabled={widgetCreating}>
                {widgetCreating ? "Creating…" : "Create embed code"}
              </button>
            {:else}
              <div class="invite-embed-row">
                <textarea readonly class="invite-embed-textarea" rows="3">{widgetEmbedCode}</textarea>
                <button type="button" class="btn-copy" onclick={() => copyWidgetCode(widgetEmbedCode)}>Copy code</button>
              </div>
              <p class="invite-embed-hint">Paste this script into your website's HTML before &lt;/body&gt;</p>
            {/if}
          </section>

          <section class="invite-section-block">
            <h4 class="invite-section-title">Quick copy</h4>
            <div class="invite-quickcopy-row">
              <button type="button" class="btn-quickcopy" onclick={copySimpleMessage}>
                Simple message
              </button>
              <button type="button" class="btn-quickcopy" onclick={copyDetailedMessage} disabled={!inviteLinkValue}>
                Detailed message
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  {/if}

  {#if showRoomSettings}
    <div
      class="drawer-overlay"
      role="dialog"
      aria-label="Room settings"
      tabindex="-1"
      onclick={(e) => e.target === e.currentTarget && (showRoomSettings = false)}
      onkeydown={(e) => e.key === "Escape" && (showRoomSettings = false)}
    >
      <div class="drawer-panel settings-drawer" role="region" aria-label="Room settings">
        <div class="drawer-header">
          <h3 class="drawer-title">Room Settings</h3>
          <button type="button" class="drawer-close" onclick={() => (showRoomSettings = false)} aria-label="Close">×</button>
        </div>
        <div class="drawer-body">
          <section class="settings-section">
            <h4 class="settings-section-title">Room Status</h4>
            <p class="settings-hint">Inactive rooms won't appear in active conversations list.</p>
            <div class="settings-status-row">
              <span class="settings-status-label">Status: <strong>{room.status === "active" ? "Active" : "Inactive"}</strong></span>
              <button type="button" class="btn-toggle-status" onclick={toggleRoomStatus}>
                {room.status === "active" ? "Deactivate Room" : "Activate Room"}
              </button>
            </div>
          </section>

          <section class="settings-section">
            <h4 class="settings-section-title">Room Members ({userCount})</h4>
            <p class="settings-hint">Manage users in this room. You can kick users who are disruptive.</p>
            {#if users.length === 0}
              <p class="settings-empty">No users currently in room.</p>
            {:else}
              <ul class="settings-members-list">
                {#each users as username}
                  <li class="settings-member-item">
                    <span class="settings-member-name">{username}</span>
                    {#if username !== config.username && username !== room.createdByUsername}
                      <button type="button" class="btn-kick-user" disabled={settingsKicking} onclick={() => kickUser(username)}>
                        Kick
                      </button>
                    {:else if username === room.createdByUsername}
                      <span class="settings-member-badge">Owner</span>
                    {:else}
                      <span class="settings-member-badge">You</span>
                    {/if}
                  </li>
                {/each}
              </ul>
            {/if}
          </section>

          <section class="settings-section">
            <h4 class="settings-section-title">Room Code</h4>
            <p class="settings-code">{room.code}</p>
          </section>
        </div>
      </div>
    </div>
  {/if}

  {#if showRedlinePanel && redlineMessage}
    <div class="drawer-overlay" role="dialog" aria-label="Suggest edit" tabindex="-1" onclick={(e) => e.target === e.currentTarget && (showRedlinePanel = false)} onkeydown={(e) => e.key === "Escape" && (showRedlinePanel = false)}>
      <div class="drawer-panel invite-drawer" role="region" aria-label="Suggest edit panel">
        <div class="drawer-header">
          <h3 class="drawer-title">Suggest edit (redlining)</h3>
          <button type="button" class="drawer-close" onclick={() => (showRedlinePanel = false)} aria-label="Close">×</button>
        </div>
        <div class="drawer-body">
          <p class="invite-label">Original</p>
          <p class="redline-original-block">{redlineMessage.message}</p>
          <label class="invite-label" for="redline-suggested">Suggested text</label>
          <textarea id="redline-suggested" bind:value={redlineSuggested} class="invite-input" rows="4" placeholder="Enter suggested text"></textarea>
          <div class="drawer-actions">
            <button type="button" class="btn-copy" onclick={sendRedline} disabled={!redlineSuggested.trim()}>Send suggestion</button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if showPaymentPanel}
    <div class="drawer-overlay" role="dialog" aria-label="Request payment" tabindex="-1" onclick={(e) => e.target === e.currentTarget && (showPaymentPanel = false)} onkeydown={(e) => e.key === "Escape" && (showPaymentPanel = false)}>
      <div class="drawer-panel invite-drawer" role="region" aria-label="Payment request panel">
        <div class="drawer-header">
          <h3 class="drawer-title">Request payment</h3>
          <button type="button" class="drawer-close" onclick={() => (showPaymentPanel = false)} aria-label="Close">×</button>
        </div>
        <div class="drawer-body">
          <label class="invite-label" for="payment-amount">Amount</label>
          <input id="payment-amount" type="number" step="0.01" bind:value={paymentAmount} class="invite-input" placeholder="0.00" />
          <label class="invite-label" for="payment-currency">Currency</label>
          <select id="payment-currency" bind:value={paymentCurrency} class="invite-input">
            <option value="KES">KES</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
          <div class="drawer-actions">
            <button type="button" class="btn-copy" onclick={sendPaymentRequest} disabled={!paymentAmount.trim()}>Send request</button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if showSignPanel}
    <div class="drawer-overlay" role="dialog" aria-label="Sign" tabindex="-1" onclick={(e) => e.target === e.currentTarget && (showSignPanel = false)} onkeydown={(e) => e.key === "Escape" && (showSignPanel = false)}>
      <div class="drawer-panel invite-drawer" role="region" aria-label="Signature panel">
        <div class="drawer-header">
          <h3 class="drawer-title">E-signature</h3>
          <button type="button" class="drawer-close" onclick={() => (showSignPanel = false)} aria-label="Close">×</button>
        </div>
        <div class="drawer-body">
          <p class="invite-hint">Draw your signature below, then capture and send.</p>
          <canvas
            bind:this={signCanvasEl}
            width="320"
            height="120"
            class="signature-canvas"
            style="border:2px solid var(--border);border-radius:8px;background:var(--card-bg);touch-action:none;cursor:crosshair;"
            onmousedown={signStart}
            onmousemove={signMove}
            onmouseup={signEnd}
            onmouseleave={signEnd}
            ontouchstart={signStart}
            ontouchmove={signMove}
            ontouchend={signEnd}
          ></canvas>
          <div class="drawer-actions">
            <button type="button" class="btn-generate-link" onclick={captureSignature}>Capture</button>
            <button type="button" class="btn-copy" onclick={sendSignature} disabled={!signatureDataUrl}>Send signature</button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if showDealPanel}
    <div
      class="drawer-overlay"
      role="dialog"
      aria-label="Current terms"
      tabindex="-1"
      onclick={(e) => e.target === e.currentTarget && (showDealPanel = false)}
      onkeydown={(e) => e.key === "Escape" && (showDealPanel = false)}
    >
      <div class="drawer-panel terms-drawer" role="region" aria-label="Current terms panel">
        <div class="drawer-header">
          <h3 class="drawer-title">Current terms</h3>
          <button type="button" class="drawer-close" onclick={() => (showDealPanel = false)} aria-label="Close">×</button>
        </div>
        <div class="drawer-body">
          <DealPanel roomId={room.id} username={config.username} {socket} config={config} onSendTerms={sendDealTerms} initialTerms={latestDealTerms} />
        </div>
      </div>
    </div>
  {/if}

  {#if showCalculator}
    <div
      class="drawer-overlay"
      role="dialog"
      aria-label="Calculator"
      tabindex="-1"
      onclick={(e) => e.target === e.currentTarget && (showCalculator = false)}
      onkeydown={(e) => e.key === "Escape" && (showCalculator = false)}
    >
      <div class="drawer-panel calculator-drawer" role="region" aria-label="Calculator panel">
        <div class="drawer-header">
          <h3 class="drawer-title">Calculator</h3>
          <button type="button" class="drawer-close" onclick={() => (showCalculator = false)} aria-label="Close">×</button>
        </div>
        <div class="drawer-body">
          <Calculator onInsertResult={insertResultFromCalculator} />
        </div>
      </div>
    </div>
  {/if}

  {#if showNegotiationForm}
    <div class="negotiation-form">
      <div class="negotiation-form-inner">
        <h4>Start group negotiation</h4>
        <textarea
          bind:value={negotiationProposal}
          placeholder="Describe your proposal..."
          rows="2"
        ></textarea>
        <div class="negotiation-form-actions">
          <button type="button" onclick={() => (showNegotiationForm = false)}>Cancel</button>
          <button
            type="button"
            onclick={startNegotiation}
            disabled={!negotiationProposal.trim()}
          >
            Start
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if isNegotiationActive && currentNegotiation}
    <div class="active-negotiation">
      <div class="active-negotiation-inner">
        <h4>Active negotiation</h4>
        <p><strong>Proposal:</strong> {currentNegotiation.proposal}</p>
        <p><strong>Proposed by:</strong> {currentNegotiation.proposer}</p>
        {#if negotiationVoteCounts.approve > 0 || negotiationVoteCounts.reject > 0}
          <p class="vote-summary">
            {negotiationVoteCounts.approve} approved, {negotiationVoteCounts.reject} rejected
          </p>
        {/if}

        {#if !currentNegotiation.hasVoted && currentNegotiation.proposer !== config.username}
          <div class="vote-buttons">
            <button type="button" class="btn-vote approve" onclick={() => vote("approve")}>
              Approve
            </button>
            <button type="button" class="btn-vote reject" onclick={() => vote("reject")}>
              Reject
            </button>
          </div>
        {:else if currentNegotiation.hasVoted}
          <p class="voted-status">You have voted.</p>
        {:else}
          <p class="voted-status">Waiting for others to vote.</p>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Top: toolbar row (above messages) -->
  <div class="input-toolbar-section">
    {#if replyingTo}
      <div class="replying-to-bar">
        <span class="replying-to-label">Replying to {replyingTo.username}:</span>
        <span class="replying-to-snippet">{replyingTo.snippet}</span>
        <button type="button" class="replying-to-cancel" onclick={cancelReply} aria-label="Cancel reply">Cancel</button>
      </div>
    {/if}
    <div class="input-toolbar-top">
      <select class="input-channel-select" aria-label="Channel">
        <option value="nego">Nego</option>
        <option value="whatsapp">WhatsApp</option>
      </select>
      <button type="button" class="btn-toolbar" onclick={() => { showQuickReplies = false; showCustomSnippets = !showCustomSnippets; }} title="Snippets (or type /)" aria-expanded={showCustomSnippets} aria-haspopup="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <span>Snippets</span>
      </button>
      <button type="button" class="btn-toolbar" onclick={() => { showEmojiPicker = !showEmojiPicker; playClick(); }} title="Emoji (or type :)" aria-expanded={showEmojiPicker}>
        <span class="emoji-toolbar-icon">😊</span>
        <span>Emoji</span>
      </button>
      <button type="button" class="btn-toolbar btn-toolbar-location" onclick={shareLocation} title="Share location">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        <span>Location</span>
      </button>
      <button type="button" class="btn-tool btn-tool-action" onclick={() => { showCalculator = false; showDealPanel = !showDealPanel; playClick(); }} title="Current terms (price, qty, SLA)" aria-pressed={showDealPanel}>Terms</button>
      <button type="button" class="btn-tool btn-tool-action" onclick={() => { showDealPanel = false; showCalculator = !showCalculator; playClick(); }} title="Calculator" aria-pressed={showCalculator}>Calculator</button>
      <button type="button" class="btn-tool btn-tool-action" onclick={() => fileInputEl?.click()} title="Documents" disabled={uploadInProgress}>{uploadInProgress ? "Uploading…" : "Documents"}</button>
      <button type="button" class="btn-tool btn-tool-action" onclick={() => { showPaymentPanel = true; playClick(); }} title="Request payment">Payment</button>
      <button type="button" class="btn-tool btn-tool-action" onclick={openSignPanel} title="Add signature">Sign</button>
      <button type="button" class="btn-tool btn-tool-action" onclick={openInvoice} title="Generate invoice">Invoice</button>
      <span class="input-toolbar-top-divider" aria-hidden="true"></span>
      <span class="input-footer-label">AI</span>
      <button type="button" class="btn-ai-assist" title="AI Assist" aria-label="AI Assist">AI Assist</button>
      <button type="button" class="btn-summarize" title="Summarize" aria-label="Summarize">Summarize</button>
    </div>
    {#if showCustomSnippets}
      <div class="quick-replies-dropdown input-dropdown-snippets" role="menu">
        {#if getCustomSnippets().length > 0}
          {#each getCustomSnippets() as s}
            <button type="button" class="quick-reply-option" role="menuitem" onclick={() => insertCustomSnippet(s.body)}>
              <span class="snippet-option-name">{s.name}</span>
              {#if s.body.length > 40}<span class="snippet-option-preview">{s.body.slice(0, 40)}…</span>{/if}
            </button>
          {/each}
        {/if}
        <div class="snippet-quick-divider">Quick replies</div>
        {#each QUICK_REPLIES as text}
          <button type="button" class="quick-reply-option" role="menuitem" onclick={() => insertQuickReply(text)}>{text}</button>
        {/each}
        {#if getCustomSnippets().length === 0}
          <div class="snippets-empty">Add custom snippets in Settings.</div>
        {/if}
      </div>
    {/if}
    {#if showEmojiPicker}
      <div class="emoji-picker-grid" role="listbox">
        {#each EMOJI_SHORTCODES as e}
          <button type="button" class="emoji-picker-btn" role="option" aria-selected="false" onclick={() => insertEmojiFromPicker(e.char)} title={e.code}>{e.char}</button>
        {/each}
      </div>
    {/if}
  </div>

  <div class="messages-wrap">
    <!-- Human handover: when room is assigned to an agent, show option to take over (e.g. to send images) -->
    {#if room.assignedTo && room.assignedTo.startsWith && room.assignedTo.startsWith('agent:') && room.createdByUsername === config.username}
      <div class="handover-bar" role="region" aria-label="Agent handling">
        <span class="handover-text">{getAssignedToDisplay(room.assignedTo)} is handling this conversation.</span>
        <button type="button" class="handover-btn" onclick={() => assignTo(config.username)} disabled={assignInProgress} title="Take over to reply and send images yourself">
          Take over
        </button>
      </div>
    {/if}
    <div class="messages-scroll" bind:this={messagesContainer}>
    <!-- Agreed terms / negotiation proposal at top (from conversation or from who started negotiation) -->
    {#if termsSummary}
      <div class="terms-summary-bar" role="region" aria-label="Current terms">
        {#if termsSummary.type === "deal_terms"}
          <span class="terms-summary-text">
            <strong>Agreed terms:</strong> Price {formatTermsMoney(termsSummary.price)} × {termsSummary.qty ?? "—"} · Total {formatTermsMoney(termsSummary.total ?? termsSummary.subtotal)}
          </span>
        {:else}
          <span class="terms-summary-text"><strong>Proposal:</strong> {termsSummary.proposal}</span>
        {/if}
        <button type="button" class="terms-summary-amend" onclick={() => (showDealPanel = true)}>Amend</button>
      </div>
    {:else}
      <div class="terms-summary-bar terms-summary-empty">
        <span class="terms-summary-text">No terms yet</span>
        <button type="button" class="terms-summary-amend" onclick={() => (showDealPanel = true)}>Propose terms</button>
      </div>
    {/if}
    {#if room.description && !greetingDismissed}
      <div class="room-greeting">
        <p class="room-greeting-desc">{room.description}</p>
        <button type="button" class="room-greeting-dismiss" onclick={() => (greetingDismissed = true)} aria-label="Dismiss">Dismiss</button>
      </div>
    {/if}
    {#each messages as message}
      <div class="message {getMessageClass(message)}">
        {#if message.username}
          {@const avatarType = getAvatarType(message.username)}
          {#if avatarType === "male"}
            <span class="message-avatar message-avatar-icon" title={message.username} aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M5 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/></svg>
            </span>
          {:else if avatarType === "female"}
            <span class="message-avatar message-avatar-icon" title={message.username} aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="3"/><path d="M12 14c-4 0-6 2-6 4v2h12v-2c0-2-2-4-6-4z"/></svg>
            </span>
          {:else}
            <span class="message-avatar" title={message.username}>{getAvatarLetter(message.username)}</span>
          {/if}
        {/if}
        <div class="message-content">
        {#if message.type === "text"}
          <div class="message-header">
            <span class="msg-username">{message.username}</span>
            <button type="button" class="msg-reply-btn" onclick={() => replyToMessage(message)} title="Reply to this message">Reply</button>
            <button type="button" class="msg-reply-btn" onclick={() => openSuggestEdit(message)} title="Suggest edit (redlining)">Suggest edit</button>
            <span class="msg-time">{formatTime(message.timestamp)}</span>
          </div>
          {#if message.replyToMessageId}
            {@const replyToMsg = getMessageById(message.replyToMessageId)}
            {#if replyToMsg}
              <div class="message-reply-to" role="region" aria-label="Reply to {replyToMsg.username}">
                <span class="reply-to-label">Replying to {replyToMsg.username}:</span>
                <blockquote class="reply-to-quote">{replyToMsg.message && (replyToMsg.message.length > 80 ? replyToMsg.message.slice(0, 80) + "..." : replyToMsg.message)}</blockquote>
              </div>
            {/if}
          {/if}
          <div class="message-body">
            {#each formatMessageBody(message.message) as part}
              {#if part.type === "mention"}
                <span class="mention">@{part.value}</span>
              {:else}
                {part.value}
              {/if}
            {/each}
          </div>
          {#if message.username === config.username}
            <div class="message-status">Sent</div>
          {/if}
        {:else if message.type === "location"}
          <div class="message-header">
            <span class="msg-username">{message.username}</span>
            <span class="msg-time">{formatTime(message.timestamp)}</span>
          </div>
          <div class="location-msg">
            <div class="location-body">
              <span class="location-label">{message.message}</span>
              <div class="location-coords">
                <small>Lat: {message.location.latitude.toFixed(6)}, Lng: {message.location.longitude.toFixed(6)}</small>
                {#if message.location.accuracy}
                  <small>Accuracy: ±{Math.round(message.location.accuracy)}m</small>
                {/if}
              </div>
              <button
                type="button"
                class="btn-maps"
                onclick={() =>
                  openLocationInMaps(
                    message.location.latitude,
                    message.location.longitude
                  )}
              >
                Open in maps
              </button>
            </div>
          </div>
        {:else if message.type === "location-loading"}
          <div class="message-header">
            <span class="msg-username">{message.username}</span>
            <span class="msg-time">{formatTime(message.timestamp)}</span>
          </div>
          <div class="location-loading-msg">
            <span class="loading-dot"></span>
            {message.message}
          </div>
        {:else if message.type === "deal_terms"}
          <div class="message-header">
            <span class="msg-username">{message.username}</span>
            <span class="msg-time">{formatTime(message.timestamp)}</span>
          </div>
          <div class="deal-terms-widget">
            <p class="deal-terms-label">{message.message}</p>
            {#if message.payload}
              <ul class="deal-terms-list">
                <li>Price: {formatDealVal(message.payload.price)}</li>
                <li>Qty: {message.payload.qty ?? "—"}</li>
                <li>SLA (days): {message.payload.slaDays ?? message.payload.sla ?? "—"}</li>
                {#if message.payload.subtotal != null}<li>Subtotal: {formatDealVal(message.payload.subtotal)}</li>{/if}
                {#if message.payload.tax != null}<li>Tax: {formatDealVal(message.payload.tax)}</li>{/if}
                {#if message.payload.shipping != null}<li>Shipping: {formatDealVal(message.payload.shipping)}</li>{/if}
                {#if message.payload.total != null}<li><strong>Total: {formatDealVal(message.payload.total)}</strong></li>{/if}
                {#if message.payload.margin != null}<li>Margin: {formatDealVal(message.payload.margin)}</li>{/if}
                {#if message.payload.versionCount != null && message.payload.versionCount > 0}<li class="deal-terms-versions">Version history: {message.payload.versionCount} change(s)</li>{/if}
              </ul>
            {/if}
            {#if message.status === "pending"}
              <span class="deal-terms-pending">Sending…</span>
            {:else if message.username === config.username}
              <span class="deal-terms-status">Sent</span>
            {/if}
          </div>
        {:else if message.type === "document"}
          <div class="message-header">
            <span class="msg-username">{message.username}</span>
            <span class="msg-time">{formatTime(message.timestamp)}</span>
          </div>
          <div class="document-msg">
            <span class="document-label">Document: {message.message}</span>
            {#if message.documentUrl || message.payload?.url}
              {@const docUrl = message.documentUrl || message.payload?.url}
              <a href={docUrl.startsWith("http") ? docUrl : (config.serverUrl || "") + docUrl} target="_blank" rel="noopener noreferrer" class="document-link">Open / download</a>
            {/if}
            {#if message.status === "pending"}
              <span class="document-pending">Uploading…</span>
            {:else if message.username === config.username}
              <span class="document-status">Sent</span>
            {/if}
          </div>
        {:else if message.type === "redline"}
          <div class="message-header">
            <span class="msg-username">{message.username}</span>
            <span class="msg-time">{formatTime(message.timestamp)}</span>
          </div>
          <div class="redline-msg">
            <p class="redline-label">Suggested edit</p>
            {#if message.payload?.original}
              <p class="redline-original"><del>{message.payload.original}</del></p>
            {/if}
            {#if message.payload?.suggested}
              <p class="redline-suggested">{message.payload.suggested}</p>
            {/if}
          </div>
        {:else if message.type === "signature"}
          <div class="message-header">
            <span class="msg-username">{message.username}</span>
            <span class="msg-time">{formatTime(message.timestamp)}</span>
          </div>
          <div class="signature-msg">
            {#if message.payload?.imageUrl}
              <img src={message.payload.imageUrl} alt="Signature" class="signature-img" />
            {/if}
            {#if message.payload?.label}<p class="signature-label">{message.payload.label}</p>{/if}
          </div>
        {:else if message.type === "payment_request"}
          <div class="message-header">
            <span class="msg-username">{message.username}</span>
            <span class="msg-time">{formatTime(message.timestamp)}</span>
          </div>
          <div class="payment-msg">
            <p class="payment-label">Payment request: {message.payload?.amount ?? "—"} {message.payload?.currency ?? "KES"}</p>
            <a href={`${config.serverUrl}/api/rooms/${room.id}/invoice?amount=${message.payload?.amount ?? ''}&currency=${message.payload?.currency ?? 'KES'}&reference=${message.payload?.reference ?? ''}`} target="_blank" rel="noopener noreferrer" class="document-link">View invoice</a>
          </div>
        {:else}
          <div class="system-msg">
            <span class="system-text">{message.message}</span>
            <span class="msg-time">{formatTime(message.timestamp)}</span>
          </div>
        {/if}
        </div>
      </div>
    {/each}

    {#if typingUsers.length > 0}
      <div class="typing-indicator">
        <div class="typing-inner">
          <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span class="typing-text">
            {typingUsers.length === 1
              ? `${typingUsers[0]} is typing...`
              : `${typingUsers.slice(0, 2).join(", ")}${typingUsers.length > 2 ? ` and ${typingUsers.length - 2} others` : ""} typing...`}
          </span>
        </div>
      </div>
    {/if}
    </div>
  </div>

  <!-- Message input: only when parent does not provide it via getSendMessage -->
  {#if typeof getSendMessage === "undefined" || !getSendMessage}
  <div class="input-area respondio-input-area input-area-bottom chat-input-bar-fixed">
    <div class="input-row input-row-bottom">
      <div class="input-with-mentions">
        <textarea
          bind:this={messageInputEl}
          bind:value={newMessage}
          placeholder="Type your message…"
          rows="1"
          oninput={handleMessageInput}
          onkeydown={handleInputKeydown}
          onkeypress={handleKeyPress}
        ></textarea>
        {#if mentionShow && mentionCandidates.length > 0}
          <div class="mention-dropdown" bind:this={mentionListEl} role="listbox">
            {#each mentionCandidates.slice(0, 5) as user}
              <button type="button" class="mention-option" role="option" aria-selected="false" onclick={() => insertMention(user)}>{user}</button>
            {/each}
          </div>
        {/if}
        {#if snippetShow && snippetCandidates.length > 0}
          <div class="mention-dropdown snippet-dropdown" role="listbox">
            {#each snippetCandidates as item}
              <button type="button" class="mention-option" role="option" aria-selected="false" onclick={() => insertSnippetAtSlash(item.body)}>
                <span class="snippet-option-name">{item.name}</span>
                {#if item.body.length > 35}<span class="snippet-option-preview">{item.body.slice(0, 35)}…</span>{/if}
              </button>
            {/each}
          </div>
        {/if}
        {#if emojiShow && emojiCandidates.length > 0}
          <div class="mention-dropdown emoji-dropdown" role="listbox">
            {#each emojiCandidates as e}
              <button type="button" class="mention-option emoji-option" role="option" aria-selected="false" onclick={() => insertEmojiAtColon(e.char)} title={e.code}>
                <span class="emoji-char">{e.char}</span>
                <span class="emoji-code">:{e.code}</span>
              </button>
            {/each}
          </div>
        {/if}
        {#if variableShow && variableCandidates.length > 0}
          <div class="mention-dropdown variable-dropdown" role="listbox">
            {#each variableCandidates as v}
              <button type="button" class="mention-option" role="option" aria-selected="false" onclick={() => insertVariableAtDollar(v.template)} title={v.key}>
                <span class="variable-key">{v.key}</span>
                <span class="variable-template">{v.template}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
      <button type="button" class="btn-input-action" onclick={() => fileInputEl?.click()} title="Documents" aria-label="Upload document" disabled={uploadInProgress}>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      </button>
      <button type="button" class="btn-input-action" onclick={() => { showEmojiPicker = !showEmojiPicker; playClick(); }} title="Emoji" aria-label="Emoji" aria-expanded={showEmojiPicker}>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
      </button>
      <button type="button" class="btn-input-action btn-ai-response" title="AI Response" aria-label="AI Response">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
      </button>
      <button type="button" class="btn-send" onclick={sendMessage} disabled={!newMessage.trim()}>Send</button>
    </div>
  </div>
  {/if}
</div>

<style>
  .chat-room {
    height: 100%;
    min-height: 0;
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr);
    overflow: hidden;
    position: relative;
  }

  .chat-room .chat-header {
    grid-row: 1;
  }

  .chat-room .input-toolbar-section {
    grid-row: 2;
  }

  .chat-room .messages-wrap {
    grid-row: 3;
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  .handover-bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.5rem 1.25rem;
    background: var(--gray-100);
    border-bottom: 1px solid var(--border);
    font-size: 0.8125rem;
  }

  .handover-text {
    color: var(--text-secondary);
  }

  .handover-btn {
    flex-shrink: 0;
    padding: 0.35rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--card-bg);
    color: var(--text-primary);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .handover-btn:hover:not(:disabled) {
    background: var(--gray-200);
    border-color: var(--gray-400);
  }

  .handover-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .terms-summary-bar {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.5rem 1.25rem;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    font-size: 0.8125rem;
  }

  .terms-summary-bar.terms-summary-empty {
    background: transparent;
    border-bottom-color: var(--border);
  }

  .terms-summary-text {
    color: var(--text-primary);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .terms-summary-amend {
    flex-shrink: 0;
    padding: 0.35rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--card-bg);
    color: var(--text-primary);
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .terms-summary-amend:hover {
    background: var(--gray-100);
    border-color: var(--gray-400);
  }

  .chat-room .messages-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 1.25rem;
    /* Enough bottom padding so last message stays visible above fixed input bar */
    padding-bottom: 8rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .chat-header {
    padding: 1rem 1.25rem;
    border-bottom: 2px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
    background: var(--bg-secondary);
    flex-shrink: 0;
    transition: background-color var(--duration-normal) var(--ease-in-out);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }

  .respondio-chat-header {
    flex-wrap: wrap;
  }

  .header-date {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin-left: auto;
    margin-right: 0.5rem;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .header-action-btn {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    color: var(--text-secondary);
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .header-action-btn:hover {
    background: var(--gray-100);
    color: var(--text-primary);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .btn-back {
    background: var(--bg-primary);
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
    background: var(--gray-100);
    border-color: var(--gray-300);
  }

  .room-meta {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .room-name {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--navy-900);
  }

  .user-count {
    font-size: 0.75rem;
    color: var(--gray-600);
  }

  .active-users-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    margin-top: 0.25rem;
    padding: 0.35rem 0.5rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--navy-700);
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .active-users-trigger:hover {
    background: var(--gray-100);
    border-color: var(--gray-300);
  }

  .active-users-chevron {
    font-size: 0.7rem;
    color: var(--gray-500);
  }

  .members-list-wrap {
    margin-top: 0.5rem;
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--bg-primary);
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .you-badge {
    font-size: 0.75rem;
    color: var(--gray-500);
    font-weight: 400;
  }

  .member-row.empty {
    color: var(--gray-500);
    font-style: italic;
  }

  .member-row {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.8125rem;
    color: var(--gray-700);
  }

  .member-name {
    font-weight: 500;
  }

  .btn-remove-member {
    padding: 0.2rem 0.5rem;
    font-size: 0.6875rem;
    font-weight: 600;
    background: var(--gray-100);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--gray-700);
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .btn-remove-member:hover {
    background: var(--gray-200);
    border-color: var(--gray-400);
    color: var(--gray-900);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-invite-header,
  .btn-settings-header {
    background: var(--navy-700);
    color: var(--white);
    border: none;
    border-radius: 8px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.875rem;
    font-family: inherit;
    transition: background-color 0.15s ease, transform 0.2s var(--ease-spring);
  }

  .btn-invite-header:hover {
    background: var(--navy-800);
    transform: translateY(-1px);
  }

  .header-assign-wrap {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .header-assigned-agent-badge {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .btn-assign-header {
    background: var(--gray-100);
    color: var(--gray-800);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    font-weight: 500;
    font-size: 0.875rem;
    font-family: inherit;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .btn-assign-header:hover {
    background: var(--gray-200);
    border-color: var(--gray-400);
  }

  .assign-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.35rem;
    min-width: 200px;
    padding: 0.35rem;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    z-index: 100;
  }

  .assign-dropdown-item {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: none;
    background: none;
    color: var(--text-primary);
    font-size: 0.875rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    border-radius: 6px;
    text-align: left;
    transition: background-color 0.15s ease;
  }

  .assign-dropdown-item:hover:not(:disabled) {
    background: var(--gray-100);
  }

  .assign-dropdown-item:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .assign-dropdown-divider {
    height: 1px;
    background: var(--border);
    margin: 0.35rem 0;
  }

  .assign-dropdown-label {
    padding: 0.35rem 0.75rem 0.15rem;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: var(--text-secondary);
    line-height: 1.3;
  }

  .assign-dropdown-hint {
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .btn-negotiate {
    background: var(--green-600);
    color: var(--white);
    border: none;
    border-radius: 8px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.875rem;
    font-family: inherit;
    transition: background-color 0.15s ease, transform 0.2s var(--ease-spring);
  }

  .btn-negotiate:hover {
    background: var(--green-700);
    transform: translateY(-1px);
  }

  .invite-hint {
    margin: 0 0 1rem;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .invite-row {
    margin-bottom: 1rem;
  }

  .invite-label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-secondary);
    margin-bottom: 0.35rem;
  }

  .invite-input-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .invite-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 2px solid var(--border);
    border-radius: 8px;
    font-size: 0.875rem;
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: inherit;
  }

  .btn-copy {
    padding: 0.5rem 0.75rem;
    background: var(--green-600);
    color: var(--white);
    border: none;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.15s ease;
  }

  .btn-copy:hover:not(:disabled) {
    background: var(--green-700);
  }

  .btn-copy:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .invite-extra {
    margin-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .invite-extra small {
    font-size: 0.75rem;
    color: var(--gray-500);
  }

  .btn-generate-link {
    align-self: flex-start;
    padding: 0.5rem 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-primary);
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .btn-generate-link:hover {
    background: var(--gray-100);
    border-color: var(--gray-300);
  }

  .invite-section-block {
    margin-top: 1.25rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
  }

  .invite-section-title {
    margin: 0 0 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .invite-email-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .invite-email-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 2px solid var(--border);
    border-radius: 8px;
    font-size: 0.875rem;
    background: var(--input-bg);
    color: var(--text-primary);
    font-family: inherit;
  }

  .invite-email-input:focus {
    outline: none;
    border-color: var(--green-600);
  }

  .invite-hint.small {
    margin: 0 0 0.5rem;
    font-size: 0.8125rem;
  }

  .invite-email-error {
    margin: 0.5rem 0 0;
    font-size: 0.8125rem;
    color: var(--red-600, #dc2626);
  }

  .btn-copy-email {
    flex-shrink: 0;
  }

  .btn-create-widget {
    padding: 0.625rem 1rem;
    font-size: 0.9375rem;
    font-weight: 600;
    font-family: inherit;
    background: var(--green-600);
    color: var(--white);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .btn-create-widget:hover:not(:disabled) {
    background: var(--green-700);
  }

  .btn-create-widget:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .invite-embed-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .invite-embed-textarea {
    width: 100%;
    padding: 0.625rem 0.75rem;
    font-size: 0.75rem;
    font-family: monospace;
    border: 1px solid var(--border);
    border-radius: 8px;
    resize: vertical;
    min-height: 4rem;
    background: var(--gray-50);
  }

  .invite-embed-hint {
    margin: 0.5rem 0 0;
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .invite-share-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .btn-share-option {
    padding: 0.5rem 0.75rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-primary);
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .btn-share-option:hover:not(:disabled) {
    background: var(--gray-100);
    border-color: var(--gray-300);
  }

  .btn-share-option:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .invite-quickcopy-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .btn-quickcopy {
    padding: 0.5rem 0.75rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-primary);
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .btn-quickcopy:hover:not(:disabled) {
    background: var(--gray-100);
    border-color: var(--gray-300);
  }

  .btn-quickcopy:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .negotiation-badge {
    background: var(--green-600);
    color: var(--white);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .input-toolbar-top {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    row-gap: 0.5rem;
  }

  .input-toolbar-section .input-toolbar-top {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }

  .input-toolbar-top .input-channel-select,
  .input-toolbar-top .btn-toolbar,
  .input-toolbar-top .btn-tool,
  .input-toolbar-top .btn-tool-action,
  .input-toolbar-top .btn-ai-assist,
  .input-toolbar-top .btn-summarize {
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
  }

  .input-toolbar-top .input-channel-select {
    padding: 0 0.75rem;
  }

  .input-toolbar-top .btn-toolbar {
    padding: 0 0.75rem;
  }

  .input-toolbar-top .btn-tool,
  .input-toolbar-top .btn-tool-action {
    padding: 0 0.875rem;
  }

  .input-toolbar-top-divider {
    width: 1px;
    height: 1.25rem;
    background: var(--border);
    margin: 0 0.25rem;
    flex-shrink: 0;
    align-self: center;
  }

  .input-toolbar-top .input-footer-label {
    margin: 0;
    margin-right: 0.25rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    align-self: center;
  }

  .input-row-bottom {
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    flex-shrink: 0;
    margin-top: 0.25rem;
  }

  .input-row-bottom .input-with-mentions {
    flex: 1;
    min-width: 0;
    min-height: 44px;
  }

  .input-row-bottom .input-with-mentions textarea {
    min-height: 44px;
    resize: none;
    padding: 0.6rem 0.75rem;
    border-radius: 10px;
    border: 1px solid var(--border);
    font-size: 0.9375rem;
    line-height: 1.4;
    width: 100%;
    box-sizing: border-box;
  }

  .input-row-bottom .btn-input-action {
    flex-shrink: 0;
    align-self: flex-end;
    width: 44px;
    height: 44px;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 10px;
    color: var(--text-secondary);
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  }

  .input-row-bottom .btn-input-action:hover {
    background: var(--gray-100);
    border-color: var(--gray-300);
    color: var(--text-primary);
  }

  .input-row-bottom .btn-input-action.btn-ai-response {
    color: var(--green-600);
  }

  .input-row-bottom .btn-input-action.btn-ai-response:hover {
    background: var(--green-50);
    border-color: var(--green-500);
    color: var(--green-700);
  }

  .input-row-bottom .btn-send {
    flex-shrink: 0;
    align-self: flex-end;
    min-height: 44px;
    padding: 0.6rem 1.25rem;
  }

  .btn-tool,
  .btn-tool-action {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card-bg);
    color: var(--text-primary);
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .btn-tool:hover:not(:disabled) {
    background: var(--gray-100);
    border-color: var(--gray-300);
  }

  .btn-tool[aria-pressed="true"] {
    background: var(--green-100);
    border-color: var(--green-500);
    color: var(--green-800);
  }

  .btn-tool:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .file-input-hidden {
    position: absolute;
    width: 0;
    height: 0;
    opacity: 0;
    pointer-events: none;
  }

  .drawer-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: stretch;
    justify-content: flex-end;
  }

  .drawer-panel {
    width: 100%;
    max-width: 420px;
    background: var(--bg-primary);
    border-left: 1px solid var(--border);
    box-shadow: -8px 0 24px rgba(0, 0, 0, 0.12);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
    flex-shrink: 0;
  }

  .drawer-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .drawer-close {
    width: 2rem;
    height: 2rem;
    padding: 0;
    border: none;
    background: transparent;
    font-size: 1.5rem;
    line-height: 1;
    color: var(--gray-600);
    cursor: pointer;
    border-radius: 6px;
    font-family: inherit;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .drawer-close:hover {
    background: var(--gray-200);
    color: var(--text-primary);
  }

  .drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }

  .terms-drawer .drawer-body :global(.deal-panel) {
    margin-bottom: 0;
  }

  .document-msg {
    background: var(--gray-50);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    margin-top: 0.5rem;
  }

  .document-label {
    display: block;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--navy-800);
    margin-bottom: 0.35rem;
  }

  .document-link {
    font-size: 0.875rem;
    color: var(--green-700);
    text-decoration: none;
  }

  .document-link:hover {
    text-decoration: underline;
  }

  .document-pending,
  .document-status {
    display: inline-block;
    margin-top: 0.35rem;
    font-size: 0.75rem;
    color: var(--gray-500);
  }

  .redline-msg {
    background: var(--gray-50);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    margin-top: 0.5rem;
  }

  .redline-label {
    margin: 0 0 0.35rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--gray-600);
  }

  .redline-original {
    margin: 0.25rem 0;
    font-size: 0.875rem;
    color: var(--gray-600);
  }

  .redline-suggested {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--navy-800);
  }

  .redline-original-block {
    margin: 0 0 0.5rem;
    padding: 0.5rem;
    background: var(--gray-100);
    border-radius: 8px;
    font-size: 0.875rem;
    color: var(--gray-700);
  }

  .signature-msg {
    background: var(--gray-50);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    margin-top: 0.5rem;
  }

  .signature-img {
    max-width: 200px;
    max-height: 80px;
    display: block;
    margin-top: 0.35rem;
  }

  .signature-label {
    margin: 0.25rem 0 0;
    font-size: 0.75rem;
    color: var(--gray-500);
  }

  .payment-msg {
    background: var(--gray-50);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    margin-top: 0.5rem;
  }

  .payment-label {
    margin: 0 0 0.35rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--navy-800);
  }

  .drawer-actions {
    margin-top: 1rem;
    display: flex;
    gap: 0.5rem;
  }

  .deal-terms-widget {
    background: var(--gray-50);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    margin-top: 0.5rem;
  }

  .deal-terms-label {
    margin: 0 0 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--navy-800);
  }

  .deal-terms-list {
    margin: 0;
    padding-left: 1.25rem;
    font-size: 0.875rem;
    color: var(--gray-700);
  }

  .deal-terms-list li {
    margin: 0.25rem 0;
  }

  .deal-terms-pending,
  .deal-terms-status {
    display: inline-block;
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--gray-500);
  }

  .deal-terms-status {
    color: var(--green-700);
  }

  .negotiation-form {
    background: var(--green-100);
    border-bottom: 1px solid var(--green-400);
    padding: 1rem 1.25rem;
    flex-shrink: 0;
  }

  .negotiation-form-inner h4 {
    margin: 0 0 0.5rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--green-800);
  }

  .negotiation-form-inner textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1px solid var(--green-400);
    border-radius: 8px;
    resize: vertical;
    font-family: inherit;
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
    transition: border-color 0.15s ease;
  }

  .negotiation-form-inner textarea:focus {
    outline: none;
    border-color: var(--green-600);
  }

  .negotiation-form-actions {
    display: flex;
    gap: 0.5rem;
  }

  .negotiation-form-actions button {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    font-family: inherit;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .negotiation-form-actions button:first-child {
    background: var(--white);
    border: 1px solid var(--border);
    color: var(--gray-700);
  }

  .negotiation-form-actions button:last-child {
    background: var(--green-600);
    border: none;
    color: var(--white);
  }

  .negotiation-form-actions button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .active-negotiation {
    background: var(--green-100);
    border-bottom: 1px solid var(--green-400);
    padding: 1rem 1.25rem;
    flex-shrink: 0;
  }

  .active-negotiation-inner h4 {
    margin: 0 0 0.5rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--green-800);
  }

  .active-negotiation-inner p {
    margin: 0.25rem 0;
    font-size: 0.875rem;
    color: var(--navy-900);
  }

  .vote-buttons {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .btn-vote {
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.875rem;
    font-family: inherit;
    transition: background-color 0.15s ease, transform 0.2s var(--ease-spring);
  }

  .btn-vote.approve {
    background: var(--green-600);
    color: var(--white);
  }

  .btn-vote.reject {
    background: var(--gray-500);
    color: var(--white);
  }

  .btn-vote:hover {
    transform: translateY(-1px);
  }

  .voted-status {
    color: var(--gray-600);
    font-size: 0.875rem;
    font-style: italic;
    margin-top: 0.5rem;
  }

  .vote-summary {
    font-size: 0.8125rem;
    color: var(--text-secondary);
    margin: 0.25rem 0 0;
    font-weight: 500;
  }

  .room-greeting {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    margin-bottom: 0.5rem;
    background: var(--green-100);
    border: 1px solid var(--green-400);
    border-radius: 10px;
  }

  .room-greeting-desc {
    flex: 1;
    font-size: 0.875rem;
    color: var(--green-800);
    margin: 0;
    line-height: 1.4;
  }

  .room-greeting-dismiss {
    background: none;
    border: none;
    color: var(--green-800);
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    font-family: inherit;
  }

  .room-greeting-dismiss:hover {
    text-decoration: underline;
  }

  .messages-scroll {
    position: relative;
  }

  .message {
    display: flex;
    flex-direction: row;
    gap: 0.5rem;
    align-items: flex-start;
    max-width: 85%;
    word-wrap: break-word;
    animation: msgAppear 0.3s var(--ease-out-expo);
  }

  .own-message {
    flex-direction: row-reverse;
    align-self: flex-end;
  }

  .other-message {
    align-self: flex-start;
  }

  .message-avatar {
    width: 36px;
    height: 36px;
    min-width: 36px;
    min-height: 36px;
    border-radius: 50%;
    background: var(--navy-600);
    color: var(--white);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .own-message .message-avatar {
    background: var(--accent);
  }

  .message-avatar.message-avatar-icon {
    background: var(--navy-500);
    color: var(--white);
  }

  .own-message .message-avatar.message-avatar-icon {
    background: var(--accent);
    color: var(--white);
  }

  .message-avatar.message-avatar-icon svg {
    display: block;
  }

  .message-content {
    flex: 1;
    min-width: 0;
  }

  .system-message,
  .negotiation-message,
  .negotiation-end-message,
  .vote-message {
    align-self: center;
    max-width: 90%;
    text-align: center;
  }

  .system-message .message-content,
  .negotiation-message .message-content,
  .negotiation-end-message .message-content,
  .vote-message .message-content {
    display: flex;
    justify-content: center;
  }

  .message-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .msg-username {
    font-weight: 600;
    font-size: 0.8125rem;
    color: var(--navy-800);
  }

  .own-message .msg-username {
    color: var(--navy-700);
  }

  .msg-time {
    font-size: 0.6875rem;
    color: var(--gray-500);
  }

  .message-body {
    background: var(--gray-100);
    padding: 0.75rem 1rem;
    border-radius: 12px;
    font-size: 0.9375rem;
    line-height: 1.4;
    color: var(--navy-900);
  }

  .own-message .message-body {
    background: var(--msg-out-bg);
    border: var(--msg-out-border, none);
    color: var(--msg-out-color, var(--white));
  }

  .system-msg {
    background: transparent;
    color: var(--gray-500);
    padding: 0.5rem 0;
    border-radius: 0;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 1rem 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .negotiation-message .system-msg {
    background: var(--green-100);
    color: var(--green-800);
  }

  .negotiation-end-message .system-msg {
    background: var(--green-100);
    color: var(--green-800);
  }

  .vote-message .system-msg {
    background: var(--gray-200);
    color: var(--gray-800);
  }

  .system-text {
    flex: 1;
  }

  .typing-indicator {
    align-self: flex-start;
    margin-bottom: 0.5rem;
  }

  .typing-inner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--gray-100);
    padding: 0.5rem 1rem;
    border-radius: 12px;
    font-size: 0.8125rem;
    color: var(--gray-600);
  }

  .typing-dots {
    display: flex;
    gap: 3px;
  }

  .typing-dots span {
    width: 4px;
    height: 4px;
    background: var(--navy-600);
    border-radius: 50%;
    animation: typingBounce 1.2s var(--ease-out-expo) infinite;
  }

  .typing-dots span:nth-child(1) { animation-delay: 0s; }
  .typing-dots span:nth-child(2) { animation-delay: 0.15s; }
  .typing-dots span:nth-child(3) { animation-delay: 0.3s; }

  @keyframes msgAppear {
    from {
      opacity: 0;
      transform: scale(0.97) translateY(4px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  @keyframes typingBounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
    30% { transform: translateY(-4px); opacity: 1; }
  }

  .input-area {
    padding: 1rem 1.25rem;
    border-top: 1px solid var(--border);
    background: var(--bg-primary);
    flex-shrink: 0;
    transition: background-color var(--duration-normal) var(--ease-in-out);
  }

  .input-toolbar-section {
    flex-shrink: 0;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .respondio-input-area.input-area-bottom {
    min-height: 64px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    background: var(--bg-primary);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
    z-index: 2;
  }

  .input-toolbar,
  .input-toolbar-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .btn-toolbar {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card-bg);
    color: var(--text-primary);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .btn-toolbar:hover {
    background: var(--gray-100);
    border-color: var(--gray-300);
  }

  .btn-toolbar span:first-of-type:not(.emoji-toolbar-icon) {
    display: none;
  }

  @media (min-width: 420px) {
    .btn-toolbar span { display: inline; }
  }

  .emoji-toolbar-icon {
    font-size: 1.125rem;
  }

  .btn-toolbar-location {
    color: var(--green-700);
  }

  .input-channel-select {
    padding: 0.35rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    font-family: inherit;
    background: var(--card-bg);
    color: var(--text-primary);
    cursor: pointer;
  }

  .input-channel-select:focus {
    outline: none;
    border-color: var(--green-600);
  }

  .btn-add-comment {
    padding: 0.25rem 0.5rem;
    border: none;
    background: none;
    color: var(--text-secondary);
    font-size: 0.8125rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: color 0.15s ease;
  }

  .btn-add-comment:hover {
    color: var(--text-primary);
  }

  .input-dropdown-snippets {
    margin-bottom: 0.5rem;
    position: relative;
    min-width: 200px;
  }

  .snippet-quick-divider {
    padding: 0.35rem 0.75rem;
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-top: 1px solid var(--border);
    margin-top: 0.25rem;
    padding-top: 0.5rem;
  }

  .emoji-picker-grid {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 0.25rem;
    padding: 0.5rem;
    margin-bottom: 0.5rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    max-width: 280px;
  }

  .emoji-picker-btn {
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    background: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1.25rem;
    transition: background-color 0.15s ease;
  }

  .emoji-picker-btn:hover {
    background: var(--gray-200);
  }

  .snippet-dropdown .snippet-option-name,
  .snippet-dropdown .snippet-option-preview {
    display: block;
  }

  .emoji-dropdown .emoji-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .emoji-char {
    font-size: 1.25rem;
  }

  .emoji-code {
    font-size: 0.75rem;
    color: var(--text-secondary);
  }

  .variable-dropdown .variable-key {
    display: block;
    font-weight: 600;
    color: var(--navy-800);
  }

  .variable-dropdown .variable-template {
    display: block;
    font-size: 0.75rem;
    color: var(--text-secondary);
    margin-top: 0.125rem;
  }

  .input-respondio-footer {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border);
  }

  .input-footer-label {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-right: 0.25rem;
  }

  .btn-ai-assist,
  .btn-summarize {
    padding: 0.4rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--card-bg);
    color: var(--text-primary);
    font-size: 0.8125rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .btn-ai-assist:hover,
  .btn-summarize:hover {
    background: var(--gray-50);
    border-color: var(--gray-300);
  }

  .replying-to-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.5rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 0.8125rem;
  }

  .replying-to-label {
    font-weight: 600;
    color: var(--text-primary);
  }

  .replying-to-snippet {
    flex: 1;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .replying-to-cancel {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 500;
    padding: 0.25rem 0.5rem;
    font-family: inherit;
  }

  .replying-to-cancel:hover {
    color: var(--text-primary);
  }

  .input-row {
    display: flex;
    align-items: flex-end;
    gap: 0.75rem;
    max-width: 800px;
    margin: 0 auto;
  }

  .input-with-mentions {
    flex: 1;
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .mention-dropdown {
    position: absolute;
    bottom: 100%;
    left: 0;
    right: 0;
    margin-bottom: 4px;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    max-height: 200px;
    overflow-y: auto;
    z-index: 10;
  }

  .mention-option {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--text-primary);
    font-family: inherit;
    transition: background-color 0.15s ease;
  }

  .mention-option:hover {
    background: var(--bg-secondary);
  }

  .input-actions-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .btn-location {
    background: var(--green-600);
    color: var(--white);
    border: none;
    border-radius: 10px;
    padding: 0.5rem;
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.15s ease, transform 0.2s var(--ease-spring);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .btn-location-icon {
    width: 2.5rem;
    height: 2.5rem;
    min-width: 2.5rem;
    min-height: 2.5rem;
  }

  .btn-location:hover {
    background: var(--green-700);
    transform: translateY(-1px);
  }

  .input-with-mentions textarea,
  .input-row textarea {
    flex: 1;
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid var(--border);
    border-radius: 10px;
    resize: none;
    font-family: inherit;
    font-size: 0.9375rem;
    transition: border-color 0.15s ease;
    max-height: 120px;
  }

  .input-with-mentions textarea:focus,
  .input-row textarea:focus {
    outline: none;
    border-color: var(--green-600);
  }

  .msg-reply-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 0.125rem 0.375rem;
    font-family: inherit;
    margin-left: auto;
  }

  .msg-reply-btn:hover {
    color: var(--accent);
  }

  .message-reply-to {
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.35rem;
    background: var(--bg-secondary);
    border-left: 4px solid var(--green-500);
    border-radius: 0 8px 8px 0;
    font-size: 0.8125rem;
  }

  .reply-to-label {
    display: block;
    font-weight: 700;
    color: var(--green-700);
    margin-bottom: 0.25rem;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .reply-to-quote {
    margin: 0;
    padding-left: 0.5rem;
    color: var(--text-secondary);
    font-style: italic;
    border: none;
  }

  .message-body .mention {
    color: var(--accent-hover, var(--green-700));
    font-weight: 600;
    background: var(--green-100);
    padding: 0.125rem 0.25rem;
    border-radius: 4px;
  }

  .own-message .message-body .mention {
    background: rgba(255, 255, 255, 0.25);
    color: var(--white);
  }

  .message-status {
    font-size: 0.6875rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
    text-align: right;
  }

  .quick-replies-wrap {
    position: relative;
    margin-bottom: 0.5rem;
  }

  .btn-quick-replies {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    padding: 0.375rem 0.75rem;
    border-radius: 8px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.15s ease, border-color 0.15s ease;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }

  .btn-quick-replies:hover {
    background: var(--gray-200);
    border-color: var(--gray-300);
    color: var(--text-primary);
  }

  .quick-replies-dropdown {
    position: absolute;
    bottom: 100%;
    left: 0;
    margin-bottom: 4px;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    max-height: 220px;
    overflow-y: auto;
    z-index: 12;
    min-width: 180px;
  }

  .quick-reply-option {
    display: block;
    width: 100%;
    padding: 0.5rem 0.75rem;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.875rem;
    color: var(--text-primary);
    font-family: inherit;
    transition: background-color 0.15s ease;
  }

  .quick-reply-option:hover {
    background: var(--bg-secondary);
  }

  .snippet-option-name {
    display: block;
    font-weight: 600;
    color: var(--navy-800);
  }

  .snippet-option-preview {
    display: block;
    font-size: 0.75rem;
    color: var(--gray-500);
    margin-top: 0.25rem;
  }

  .snippets-empty {
    padding: 0.75rem 1rem;
    font-size: 0.8125rem;
    color: var(--gray-500);
  }

  .btn-send {
    background: var(--green-600);
    color: var(--white);
    border: none;
    padding: 0.75rem 1.25rem;
    border-radius: 10px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9375rem;
    font-family: inherit;
    transition: background-color 0.15s ease, transform 0.2s var(--ease-spring);
  }

  .btn-send:hover:not(:disabled) {
    background: var(--green-700);
    transform: translateY(-1px);
  }

  .btn-send:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .location-msg {
    background: var(--green-100);
    border: 1px solid var(--green-400);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    margin-top: 0.25rem;
  }

  .location-body {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .location-label {
    font-weight: 600;
    color: var(--green-800);
    font-size: 0.875rem;
  }

  .location-coords {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    color: var(--gray-600);
    font-size: 0.75rem;
  }

  .btn-maps {
    background: var(--navy-700);
    color: var(--white);
    border: none;
    border-radius: 6px;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 600;
    font-family: inherit;
    align-self: flex-start;
    transition: background-color 0.15s ease;
  }

  .btn-maps:hover {
    background: var(--navy-800);
  }

  .location-loading-msg {
    background: var(--gray-100);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    margin-top: 0.25rem;
    color: var(--gray-700);
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .loading-dot {
    width: 8px;
    height: 8px;
    background: var(--navy-600);
    border-radius: 50%;
    animation: pulse 1s var(--ease-out-expo) infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  :global(.toast-notification) {
    position: fixed;
    top: 1.5rem;
    right: 1.5rem;
    background: var(--navy-800);
    color: var(--white);
    padding: 0.75rem 1.25rem;
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    z-index: 3000;
    font-size: 0.875rem;
    font-weight: 500;
    transform: translateX(120%);
    transition: transform 0.3s var(--ease-out-expo);
  }

  :global(.toast-notification.show) {
    transform: translateX(0);
  }

  @media (max-width: 768px) {
    .chat-header {
      padding: 0.75rem 1rem;
      flex-direction: column;
      align-items: stretch;
    }

    .header-left {
      justify-content: space-between;
    }

    .message {
      max-width: 90%;
    }

    .messages-scroll {
      padding: 1rem;
      padding-bottom: 8rem;
    }

    .input-area {
      padding: 0.75rem 1rem;
    }

    :global(.toast-notification) {
      right: 1rem;
      left: 1rem;
      transform: translateY(-100%);
    }

    :global(.toast-notification.show) {
      transform: translateY(0);
    }
  }

  .settings-section {
    margin-bottom: 1.5rem;
  }

  .settings-section-title {
    margin: 0 0 0.5rem;
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .settings-hint {
    margin: 0 0 1rem;
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .settings-status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .settings-status-label {
    font-size: 0.875rem;
  }

  .btn-toggle-status {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--card-bg);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .btn-toggle-status:hover {
    background: var(--gray-100);
  }

  .settings-empty {
    padding: 1rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .settings-members-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .settings-member-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    border-bottom: 1px solid var(--border);
  }

  .settings-member-item:last-child {
    border-bottom: none;
  }

  .settings-member-name {
    font-size: 0.9375rem;
    font-weight: 500;
  }

  .settings-member-badge {
    padding: 0.25rem 0.5rem;
    background: var(--gray-100);
    color: var(--text-secondary);
    font-size: 0.75rem;
    border-radius: 4px;
    font-weight: 500;
  }

  .btn-kick-user {
    padding: 0.35rem 0.75rem;
    border: 1px solid #ef4444;
    border-radius: 6px;
    background: var(--card-bg);
    color: #ef4444;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .btn-kick-user:hover:not(:disabled) {
    background: #fef2f2;
  }

  .btn-kick-user:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .settings-code {
    padding: 0.75rem 1rem;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 1.5rem;
    font-weight: 700;
    text-align: center;
    letter-spacing: 0.1em;
    font-family: monospace;
  }
</style>
