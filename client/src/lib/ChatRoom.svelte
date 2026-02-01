<script>
  import { onMount, onDestroy } from "svelte";
  import { playClick, playSuccess, getEnterToSend } from "./theme.js";

  export let socket = null;
  export let config = {};
  export let room = {};
  export let onLeaveRoom = () => {};

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
  let greetingDismissed = false;

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

  onMount(() => {
    if (socket) {
      joinRoom();
      setupSocketListeners();
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
      messages = [...messages, message];
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
    if (!newMessage.trim() || !socket) return;

    const payload = {
      message: newMessage.trim(),
      type: "text",
    };
    if (replyingTo) {
      payload.replyToMessageId = replyingTo.id;
    }
    socket.emit("send-message", payload);

    playClick();
    newMessage = "";
    replyingTo = null;
    mentionShow = false;
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

  function handleMessageInput() {
    const lastAt = newMessage.lastIndexOf("@");
    if (lastAt === -1) {
      mentionShow = false;
      return;
    }
    const afterAt = newMessage.slice(lastAt + 1);
    if (/\s/.test(afterAt)) {
      mentionShow = false;
      return;
    }
    mentionShow = true;
    mentionQuery = afterAt.toLowerCase();
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
    if (mentionShow && mentionCandidates.length > 0) {
      if (event.key === "Escape") {
        mentionShow = false;
        event.preventDefault();
      }
    }
  }

  function handleKeyPress(event) {
    const enterToSend = getEnterToSend();
    const isEnter = event.key === "Enter";
    const isCtrlEnter = event.ctrlKey && isEnter;

    if (mentionShow && mentionCandidates.length > 0 && isEnter) {
      if (event.key === "Escape") return;
      return;
    }

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

  function getMessageClass(message) {
    if (message.type === "system") return "system-message";
    if (message.type === "negotiation-start") return "negotiation-message";
    if (message.type === "negotiation-end") return "negotiation-end-message";
    if (message.type === "vote") return "vote-message";
    if (message.username === config.username) return "own-message";
    return "other-message";
  }

  function insertQuickReply(text) {
    newMessage = newMessage ? newMessage + " " + text : text;
    showQuickReplies = false;
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
</script>

<div class="chat-room">
  <header class="chat-header">
    <div class="header-left">
      <button type="button" class="btn-back" onclick={onLeaveRoom}>Leave</button>
      <div class="room-meta">
        <h3 class="room-name">{room.name}</h3>
        <span class="user-count">{userCount} online</span>
        {#if room.createdByUsername === config.username && users.length > 0}
          <div class="members-list" role="list">
            {#each users as u}
              <div class="member-row" role="listitem">
                <span class="member-name">{u}</span>
                {#if u !== config.username}
                  <button type="button" class="btn-remove-member" onclick={() => removeMember(u)} title="Remove from room" aria-label="Remove {u} from room">Remove</button>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <div class="header-right">
      {#if !isNegotiationActive}
        <button
          type="button"
          class="btn-negotiate"
          onclick={() => (showNegotiationForm = !showNegotiationForm)}
        >
          Start negotiation
        </button>
      {:else}
        <span class="negotiation-badge">Negotiation active</span>
      {/if}
    </div>
  </header>

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

  <div class="messages-wrap" bind:this={messagesContainer}>
    {#if room.description && !greetingDismissed}
      <div class="room-greeting">
        <p class="room-greeting-desc">{room.description}</p>
        <button type="button" class="room-greeting-dismiss" onclick={() => (greetingDismissed = true)} aria-label="Dismiss">Dismiss</button>
      </div>
    {/if}
    {#each messages as message}
      <div class="message {getMessageClass(message)}">
        {#if message.type === "text"}
          <div class="message-header">
            <span class="msg-username">{message.username}</span>
            <button type="button" class="msg-reply-btn" onclick={() => replyToMessage(message)} title="Reply to this message">Reply</button>
            <span class="msg-time">{formatTime(message.timestamp)}</span>
          </div>
          {#if message.replyToMessageId}
            {@const replyToMsg = getMessageById(message.replyToMessageId)}
            {#if replyToMsg}
              <div class="message-reply-to">
                <span class="reply-to-label">Replying to {replyToMsg.username}:</span>
                <span class="reply-to-snippet">{replyToMsg.message && (replyToMsg.message.length > 80 ? replyToMsg.message.slice(0, 80) + "..." : replyToMsg.message)}</span>
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
        {:else}
          <div class="system-msg">
            <span class="system-text">{message.message}</span>
            <span class="msg-time">{formatTime(message.timestamp)}</span>
          </div>
        {/if}
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

  <div class="input-area">
    {#if replyingTo}
      <div class="replying-to-bar">
        <span class="replying-to-label">Replying to {replyingTo.username}:</span>
        <span class="replying-to-snippet">{replyingTo.snippet}</span>
        <button type="button" class="replying-to-cancel" onclick={cancelReply} aria-label="Cancel reply">Cancel</button>
      </div>
    {/if}
    <div class="input-row input-row-wrap">
      <div class="input-with-mentions">
        <div class="quick-replies-wrap">
          <button
            type="button"
            class="btn-quick-replies"
            onclick={() => (showQuickReplies = !showQuickReplies)}
            title="Quick replies"
            aria-expanded={showQuickReplies}
            aria-haspopup="true"
          >
            Quick replies
          </button>
          {#if showQuickReplies}
            <div class="quick-replies-dropdown" role="menu">
              {#each QUICK_REPLIES as text}
                <button type="button" class="quick-reply-option" role="menuitem" onclick={() => insertQuickReply(text)}>
                  {text}
                </button>
              {/each}
            </div>
          {/if}
        </div>
        <textarea
          bind:this={messageInputEl}
          bind:value={newMessage}
          placeholder="Type your message... Use @ to mention someone"
          rows="1"
          oninput={handleMessageInput}
          onkeydown={handleInputKeydown}
          onkeypress={handleKeyPress}
        ></textarea>
        {#if mentionShow && mentionCandidates.length > 0}
          <div class="mention-dropdown" bind:this={mentionListEl} role="listbox">
            {#each mentionCandidates.slice(0, 5) as user}
              <button type="button" class="mention-option" role="option" aria-selected="false" onclick={() => insertMention(user)}>
                {user}
              </button>
            {/each}
          </div>
        {/if}
      </div>
      <div class="input-actions-row">
        <button
          type="button"
          class="btn-location"
          onclick={shareLocation}
          title="Share live location"
        >
          Location
        </button>
        <button
          type="button"
          class="btn-send"
          onclick={sendMessage}
          disabled={!newMessage.trim()}
        >
          Send
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  .chat-room {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .chat-header {
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
    background: var(--bg-secondary);
    flex-shrink: 0;
    transition: background-color var(--duration-normal) var(--ease-in-out);
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

  .members-list {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border);
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
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

  .negotiation-badge {
    background: var(--green-600);
    color: var(--white);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
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

  .messages-wrap {
    flex: 1;
    overflow-y: auto;
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .message {
    max-width: 75%;
    word-wrap: break-word;
    animation: msgAppear 0.3s var(--ease-out-expo);
  }

  .own-message {
    align-self: flex-end;
  }

  .other-message {
    align-self: flex-start;
  }

  .system-message,
  .negotiation-message,
  .negotiation-end-message,
  .vote-message {
    align-self: center;
    max-width: 90%;
    text-align: center;
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
    background: var(--navy-700);
    color: var(--white);
  }

  .system-msg {
    background: var(--navy-100);
    color: var(--navy-800);
    padding: 0.5rem 1rem;
    border-radius: 999px;
    font-size: 0.8125rem;
    display: flex;
    align-items: center;
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
    border-radius: 8px;
    padding: 0.5rem 1rem;
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 600;
    font-family: inherit;
    transition: background-color 0.15s ease, transform 0.2s var(--ease-spring);
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
    color: var(--green-600);
  }

  .message-reply-to {
    padding: 0.375rem 0.5rem;
    margin-bottom: 0.25rem;
    background: var(--bg-secondary);
    border-left: 3px solid var(--green-500);
    border-radius: 0 6px 6px 0;
    font-size: 0.8125rem;
  }

  .reply-to-label {
    font-weight: 600;
    color: var(--text-secondary);
    margin-right: 0.25rem;
  }

  .reply-to-snippet {
    color: var(--text-secondary);
  }

  .message-body .mention {
    color: var(--green-700);
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

    .messages-wrap {
      padding: 1rem;
    }

    .input-area {
      padding: 0.75rem 1rem;
    }
  }
</style>
