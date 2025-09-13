<script>
  import { onMount, onDestroy } from "svelte";

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
  let fileInputRef;
  let isUploadingFile = false;

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
        message: `Negotiation ${data.result}! Votes: ${data.votes.approve} approve, ${data.votes.reject} reject`,
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
  }

  function sendMessage() {
    if (!newMessage.trim() || !socket) return;

    socket.emit("send-message", {
      message: newMessage.trim(),
      type: "text",
    });

    newMessage = "";
  }

  function handleFileSelect() {
    fileInputRef.click();
  }

  async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Check if it's a PDF file
    if (file.type !== 'application/pdf') {
      alert('Only PDF files are allowed!');
      return;
    }

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB!');
      return;
    }

    try {
      isUploadingFile = true;
      
      const formData = new FormData();
      formData.append('pdf', file);

      const response = await fetch(`${config.serverUrl}/api/upload/pdf`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const fileInfo = await response.json();

      // Send file message via socket
      socket.emit('send-file', {
        fileInfo,
        message: newMessage.trim() || `Shared a PDF: ${file.name}`,
      });

      newMessage = "";
      event.target.value = ""; // Reset file input
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      isUploadingFile = false;
    }
  }

  async function shareLocation() {
    if (!socket) return;

    if (!navigator.geolocation) {
      alert("Geolocation is not supported by this browser.");
      return;
    }

    try {
      // Show loading state
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

      // Remove loading message
      messages = messages.filter((m) => m.id !== loadingMessage.id);

      // Send location message
      socket.emit("send-message", {
        message: `📍 Live location shared`,
        type: "location",
        location: {
          latitude,
          longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      // Remove loading message if it exists
      messages = messages.filter((m) => m.type !== "location-loading");

      if (error.code === error.PERMISSION_DENIED) {
        alert(
          "Location access denied. Please allow location access to share your location."
        );
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
        maximumAge: 60000, // Cache for 1 minute
      });
    });
  }

  function openLocationInMaps(latitude, longitude) {
    // Try to open in Google Maps, fallback to other map services
    const googleMapsUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
    const appleMapsUrl = `https://maps.apple.com/?q=${latitude},${longitude}`;
    const bingMapsUrl = `https://www.bing.com/maps?q=${latitude},${longitude}`;

    // Detect user agent and open appropriate map
    const userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.includes("iphone") || userAgent.includes("ipad")) {
      window.open(appleMapsUrl, "_blank");
    } else {
      window.open(googleMapsUrl, "_blank");
    }
  }

  function handleKeyPress(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    } else {
      // Handle typing indicator
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
  }

  function formatFileSize(bytes) {
    if (!bytes) return 'Unknown size';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  function startNegotiation() {
    if (!negotiationProposal.trim() || !socket) return;

    socket.emit("start-negotiation", {
      proposal: negotiationProposal.trim(),
    });

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
</script>

<div class="chat-room">
  <div class="chat-header">
    <div class="room-info">
      <button class="back-btn" onclick={onLeaveRoom}>← Leave</button>
      <div>
        <h3>🏠 {room.name}</h3>
        <span class="user-info">👥 {userCount} users online</span>
      </div>
    </div>

    <div class="room-actions">
      {#if !isNegotiationActive}
        <button
          class="negotiate-btn"
          onclick={() => (showNegotiationForm = !showNegotiationForm)}
        >
          🤝 Start Negotiation
        </button>
      {:else}
        <span class="negotiation-status">🤝 Negotiation Active</span>
      {/if}
    </div>
  </div>

  {#if showNegotiationForm}
    <div class="negotiation-form">
      <div class="form-content">
        <h4>🤝 Start Group Negotiation</h4>
        <textarea
          bind:value={negotiationProposal}
          placeholder="Describe your proposal..."
          rows="2"
        ></textarea>
        <div class="form-actions">
          <button onclick={() => (showNegotiationForm = false)}>Cancel</button>
          <button
            onclick={startNegotiation}
            disabled={!negotiationProposal.trim()}
          >
            Start Negotiation
          </button>
        </div>
      </div>
    </div>
  {/if}

  {#if isNegotiationActive && currentNegotiation}
    <div class="active-negotiation">
      <div class="negotiation-content">
        <h4>🤝 Active Negotiation</h4>
        <p><strong>Proposal:</strong> {currentNegotiation.proposal}</p>
        <p><strong>Proposed by:</strong> {currentNegotiation.proposer}</p>

        {#if !currentNegotiation.hasVoted && currentNegotiation.proposer !== config.username}
          <div class="vote-buttons">
            <button class="approve-btn" onclick={() => vote("approve")}>
              ✅ Approve
            </button>
            <button class="reject-btn" onclick={() => vote("reject")}>
              ❌ Reject
            </button>
          </div>
        {:else if currentNegotiation.hasVoted}
          <p class="voted-status">✓ You have voted</p>
        {:else}
          <p class="voted-status">⏳ Waiting for others to vote</p>
        {/if}
      </div>
    </div>
  {/if}

  <div class="messages-container" bind:this={messagesContainer}>
    {#each messages as message}
      <div class="message {getMessageClass(message)}">
        {#if message.type === "text"}
          <div class="message-header">
            <span class="username">{message.username}</span>
            <span class="timestamp">{formatTime(message.timestamp)}</span>
          </div>
          <div class="message-content">{message.message}</div>
        {:else if message.type === "location"}
          <div class="message-header">
            <span class="username">{message.username}</span>
            <span class="timestamp">{formatTime(message.timestamp)}</span>
          </div>
          <div class="location-message">
            <div class="location-content">
              <div class="location-text">
                📍 {message.message}
              </div>
              <div class="location-details">
                <small
                  >Lat: {message.location.latitude.toFixed(6)}, Lng: {message.location.longitude.toFixed(
                    6
                  )}</small
                >
                {#if message.location.accuracy}
                  <small
                    >Accuracy: ±{Math.round(message.location.accuracy)}m</small
                  >
                {/if}
              </div>
              <button
                class="open-maps-btn"
                onclick={() =>
                  openLocationInMaps(
                    message.location.latitude,
                    message.location.longitude
                  )}
              >
                🗺️ Open in Maps
              </button>
            </div>
          </div>
        {:else if message.type === "location-loading"}
          <div class="message-header">
            <span class="username">{message.username}</span>
            <span class="timestamp">{formatTime(message.timestamp)}</span>
          </div>
          <div class="location-loading">
            <span class="loading-spinner">🔄</span>
            {message.message}
          </div>
        {:else if message.type === "file" || message.messageType === "file"}
          <div class="message-header">
            <span class="username">{message.username}</span>
            <span class="timestamp">{formatTime(message.timestamp)}</span>
          </div>
          <div class="file-message">
            <div class="file-content">
              <div class="file-icon">📄</div>
              <div class="file-details">
                <div class="file-name">{message.fileName || 'PDF Document'}</div>
                <div class="file-size">{formatFileSize(message.fileSize)}</div>
                {#if message.message && message.message !== `Shared a PDF: ${message.fileName}`}
                  <div class="file-message-text">{message.message}</div>
                {/if}
              </div>
            </div>
            <div class="file-actions">
              <a 
                href="{config.serverUrl}{message.fileUrl}" 
                target="_blank" 
                rel="noopener noreferrer"
                class="file-download-btn"
              >
                📥 Download
              </a>
              <a 
                href="{config.serverUrl}{message.fileUrl}" 
                target="_blank" 
                rel="noopener noreferrer"
                class="file-view-btn"
              >
                👁️ View
              </a>
            </div>
          </div>
        {:else}
          <div class="system-content">
            <span class="system-icon">
              {#if message.type === "negotiation-start"}🤝
              {:else if message.type === "negotiation-end"}🏁
              {:else if message.type === "vote"}🗳️
              {:else}ℹ️{/if}
            </span>
            {message.message}
            <span class="timestamp">{formatTime(message.timestamp)}</span>
          </div>
        {/if}
      </div>
    {/each}

    {#if typingUsers.length > 0}
      <div class="typing-indicator">
        <div class="typing-content">
          <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span class="typing-text">
            {typingUsers.length === 1
              ? `${typingUsers[0]} is typing...`
              : `${typingUsers.slice(0, 2).join(", ")}${typingUsers.length > 2 ? ` and ${typingUsers.length - 2} others` : ""} are typing...`}
          </span>
        </div>
      </div>
    {/if}
  </div>

  <div class="message-input">
    <div class="input-container">
      <div class="input-actions">
        <button
          class="file-btn"
          onclick={handleFileSelect}
          title="Share PDF file"
          disabled={isUploadingFile}
        >
          {#if isUploadingFile}
            <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...$$props}>
              <path fill="currentColor" d="M2 12c0 5.523 4.477 10 10 10s10-4.477 10-10S17.523 2 12 2S2 6.477 2 12m2 0c0-4.411 3.589-8 8-8s8 3.589 8 8s-3.589 8-8 8s-8-3.589-8-8"/>
              <animateTransform attributeName="transform" dur="1s" repeatCount="indefinite" type="rotate" values="0 12 12;360 12 12"/>
            </svg>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" {...$$props}>
              <path fill="currentColor" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM6 20V4h7v5h5v11zm2-6h8v2H8zm0 3h5v2H8zm0-6h5v2H8z"/>
            </svg>
          {/if}
        </button>
        <button
          class="location-btn"
          onclick={shareLocation}
          title="Share live location"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
            {...$$props}
            ><!-- Icon from Material Design Light by Pictogrammers - https://github.com/Templarian/MaterialDesignLight/blob/master/LICENSE.md --><path
              fill="currentColor"
              d="M11.5 7A2.5 2.5 0 0 1 14 9.5a2.5 2.5 0 0 1-2.5 2.5A2.5 2.5 0 0 1 9 9.5A2.5 2.5 0 0 1 11.5 7m0 1A1.5 1.5 0 0 0 10 9.5a1.5 1.5 0 0 0 1.5 1.5A1.5 1.5 0 0 0 13 9.5A1.5 1.5 0 0 0 11.5 8m-4.7 4.36l4.7 7.73l4.7-7.73c.51-.86.8-1.81.8-2.86A5.5 5.5 0 0 0 11.5 4A5.5 5.5 0 0 0 6 9.5c0 1.05.29 2 .8 2.86m10.25.52L11.5 22l-5.55-9.12C5.35 11.89 5 10.74 5 9.5A6.5 6.5 0 0 1 11.5 3A6.5 6.5 0 0 1 18 9.5c0 1.24-.35 2.39-.95 3.38"
            /></svg
          >
        </button>
      </div>
      <textarea
        bind:value={newMessage}
        placeholder="Type your message..."
        rows="1"
        onkeypress={handleKeyPress}
      ></textarea>
      <button
        class="send-btn"
        onclick={sendMessage}
        disabled={!newMessage.trim()}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="1em"
          height="1em"
          viewBox="0 0 24 24"
          {...$$props}
          ><!-- Icon from Material Design Light by Pictogrammers - https://github.com/Templarian/MaterialDesignLight/blob/master/LICENSE.md --><path
            fill="currentColor"
            d="M6 12h8.25L11 8.75l.67-.75l4.5 4.5l-4.5 4.5l-.67-.75L14.25 13H6zm15 .5a9.5 9.5 0 0 1-9.5 9.5C6.26 22 2 17.75 2 12.5A9.5 9.5 0 0 1 11.5 3a9.5 9.5 0 0 1 9.5 9.5m-1 0A8.5 8.5 0 0 0 11.5 4A8.5 8.5 0 0 0 3 12.5a8.5 8.5 0 0 0 8.5 8.5a8.5 8.5 0 0 0 8.5-8.5"
          /></svg
        >
      </button>
    </div>
    
    <!-- Hidden file input -->
    <input 
      type="file" 
      bind:this={fileInputRef}
      accept=".pdf,application/pdf"
      onchange={handleFileUpload}
      style="display: none;"
    />
  </div>
</div>

<style>
  .chat-room {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .chat-header {
    padding: 15px 20px;
    border-bottom: 1px solid #e1e5e9;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f8f9fa;
  }

  .room-info {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .back-btn {
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 8px 12px;
    cursor: pointer;
    transition: all 0.3s;
    font-size: 14px;
  }

  .back-btn:hover {
    background: #e9e9e9;
    transform: translateX(-2px);
  }

  .room-info h3 {
    margin: 0 0 5px 0;
    color: #333;
    font-size: 1.1em;
  }

  .user-info {
    font-size: 12px;
    color: #666;
  }

  .negotiate-btn {
    background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 16px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.3s;
    font-size: 14px;
  }

  .negotiate-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(255, 152, 0, 0.4);
  }

  .negotiation-status {
    background: #ff9800;
    color: white;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
  }

  .negotiation-form {
    background: #fff3e0;
    border-bottom: 1px solid #ffcc02;
    padding: 15px 20px;
  }

  .form-content h4 {
    margin: 0 0 10px 0;
    color: #e65100;
  }

  .form-content textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid #ffcc02;
    border-radius: 8px;
    resize: vertical;
    font-family: inherit;
    margin-bottom: 10px;
  }

  .form-actions {
    display: flex;
    gap: 10px;
  }

  .form-actions button {
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.3s;
  }

  .form-actions button:first-child {
    background: white;
    border: 1px solid #ddd;
    color: #666;
  }

  .form-actions button:last-child {
    background: #ff9800;
    border: none;
    color: white;
  }

  .form-actions button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .active-negotiation {
    background: linear-gradient(135deg, #fff3e0 0%, #ffffff 100%);
    border-bottom: 1px solid #ffcc02;
    padding: 15px 20px;
  }

  .negotiation-content h4 {
    margin: 0 0 10px 0;
    color: #e65100;
  }

  .negotiation-content p {
    margin: 5px 0;
    font-size: 14px;
  }

  .vote-buttons {
    display: flex;
    gap: 10px;
    margin-top: 10px;
  }

  .approve-btn {
    background: #4caf50;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s;
  }

  .reject-btn {
    background: #f44336;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s;
  }

  .voted-status {
    color: #666;
    font-style: italic;
    margin-top: 10px;
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .message {
    max-width: 70%;
    word-wrap: break-word;
  }

  .own-message {
    align-self: flex-end;
  }

  .own-message .message-header .username {
    color: #667eea;
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
    margin-bottom: 5px;
    gap: 10px;
  }

  .username {
    font-weight: 600;
    font-size: 14px;
    color: #333;
  }

  .timestamp {
    font-size: 11px;
    color: #999;
  }

  .message-content {
    background: #f1f3f4;
    padding: 10px 15px;
    border-radius: 18px;
    font-size: 14px;
    line-height: 1.4;
  }

  .own-message .message-content {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .system-content {
    background: #e3f2fd;
    color: #1976d2;
    padding: 8px 15px;
    border-radius: 20px;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .negotiation-message .system-content {
    background: #fff3e0;
    color: #e65100;
  }

  .negotiation-end-message .system-content {
    background: #e8f5e8;
    color: #2e7d32;
  }

  .vote-message .system-content {
    background: #f3e5f5;
    color: #7b1fa2;
  }

  .system-icon {
    font-size: 14px;
  }

  .typing-indicator {
    align-self: flex-start;
    margin-bottom: 10px;
  }

  .typing-content {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #f1f3f4;
    padding: 8px 12px;
    border-radius: 15px;
    font-size: 13px;
    color: #666;
  }

  .typing-dots {
    display: flex;
    gap: 2px;
  }

  .typing-dots span {
    width: 4px;
    height: 4px;
    background: #667eea;
    border-radius: 50%;
    animation: typing 1.4s ease-in-out infinite;
  }

  .typing-dots span:nth-child(1) {
    animation-delay: 0s;
  }
  .typing-dots span:nth-child(2) {
    animation-delay: 0.2s;
  }
  .typing-dots span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typing {
    0%,
    60%,
    100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    30% {
      transform: translateY(-6px);
      opacity: 1;
    }
  }

  .message-input {
    padding: 15px 20px;
    border-top: 1px solid #e1e5e9;
    background: white;
  }

  .input-container {
    display: flex;
    align-items: flex-end;
    gap: 10px;
    max-width: 800px;
    margin: 0 auto;
  }

  .input-actions {
    display: flex;
    gap: 5px;
  }

  .location-btn {
    background: #28a745;
    color: white;
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    cursor: pointer;
    font-size: 16px;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .location-btn:hover {
    background: #218838;
    transform: scale(1.05);
  }

  .location-btn:active {
    transform: scale(0.95);
  }

  .input-container {
    display: flex;
    gap: 10px;
    align-items: end;
  }

  .input-container textarea {
    flex: 1;
    padding: 12px;
    border: 2px solid #e1e5e9;
    border-radius: 20px;
    resize: none;
    font-family: inherit;
    font-size: 14px;
    transition: border-color 0.3s;
    max-height: 100px;
  }

  .input-container textarea:focus {
    outline: none;
    border-color: #667eea;
  }

  .input-container button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    width: 45px;
    height: 45px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.3s;
    font-size: 16px;
  }

  .input-container button:hover:not(:disabled) {
    transform: scale(1.1);
    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
  }

  .input-container button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  /* Location Message Styles */
  .location-message {
    background: #e8f5e8;
    border: 1px solid #c3e6c3;
    border-radius: 10px;
    padding: 12px;
    margin-top: 5px;
  }

  .location-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .location-text {
    font-weight: 500;
    color: #2d5a2d;
  }

  .location-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: #666;
    font-size: 12px;
  }

  .open-maps-btn {
    background: #007bff;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 8px 12px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.3s ease;
    align-self: flex-start;
  }

  .open-maps-btn:hover {
    background: #0056b3;
    transform: translateY(-1px);
  }

  .location-loading {
    background: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 10px;
    padding: 12px;
    margin-top: 5px;
    color: #856404;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .loading-spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .send-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    width: 45px;
    height: 45px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.3s;
    font-size: 16px;
  }

  .send-btn:hover:not(:disabled) {
    transform: scale(1.1);
    box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
  }

  .send-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  @media (max-width: 768px) {
    .chat-header {
      padding: 10px 15px;
      flex-direction: column;
      gap: 10px;
      align-items: stretch;
    }

    .room-info {
      justify-content: space-between;
    }

    .message {
      max-width: 85%;
    }

    .messages-container {
      padding: 15px;
    }

    .message-input {
      padding: 10px 15px;
    }
  }

  /* File upload and message styles */
  .file-btn {
    background: #8b5cf6;
    border: none;
    border-radius: 50%;
    width: 40px;
    height: 40px;
    cursor: pointer;
    color: white;
    font-size: 16px;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .file-btn:hover:not(:disabled) {
    background: #7c3aed;
    transform: scale(1.1);
  }

  .file-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
    transform: none;
  }

  .file-message {
    background: #f8f9fa;
    border: 1px solid #e1e5e9;
    border-radius: 12px;
    padding: 15px;
    margin-top: 5px;
  }

  .file-content {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }

  .file-icon {
    font-size: 24px;
    color: #dc2626;
  }

  .file-details {
    flex: 1;
  }

  .file-name {
    font-weight: 600;
    color: #333;
    margin-bottom: 4px;
  }

  .file-size {
    font-size: 12px;
    color: #666;
    margin-bottom: 4px;
  }

  .file-message-text {
    font-size: 14px;
    color: #444;
    font-style: italic;
  }

  .file-actions {
    display: flex;
    gap: 8px;
  }

  .file-download-btn,
  .file-view-btn {
    background: #4f46e5;
    color: white;
    text-decoration: none;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    transition: all 0.3s;
  }

  .file-download-btn:hover,
  .file-view-btn:hover {
    background: #4338ca;
    transform: translateY(-1px);
  }

  .file-view-btn {
    background: #059669;
  }

  .file-view-btn:hover {
    background: #047857;
  }
</style>
