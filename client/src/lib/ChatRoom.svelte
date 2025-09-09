<script>
  import { onMount, onDestroy } from 'svelte';
  
  export let socket = null;
  export let config = {};
  export let room = {};
  export let onLeaveRoom = () => {};

  let messages = [];
  let newMessage = '';
  let users = [];
  let userCount = 0;
  let isNegotiationActive = false;
  let currentNegotiation = null;
  let showNegotiationForm = false;
  let negotiationProposal = '';
  let messagesContainer;

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
    socket.emit('join-room', {
      roomId: room.id,
      username: config.username
    });
  }

  function setupSocketListeners() {
    socket.on('message-history', (history) => {
      messages = history;
      scrollToBottom();
    });

    socket.on('new-message', (message) => {
      messages = [...messages, message];
      scrollToBottom();
    });

    socket.on('user-joined', (data) => {
      const systemMessage = {
        id: Date.now(),
        type: 'system',
        message: `${data.username} joined the room`,
        timestamp: new Date()
      };
      messages = [...messages, systemMessage];
      scrollToBottom();
    });

    socket.on('user-left', (data) => {
      const systemMessage = {
        id: Date.now(),
        type: 'system',
        message: `${data.username} left the room`,
        timestamp: new Date()
      };
      messages = [...messages, systemMessage];
      scrollToBottom();
    });

    socket.on('room-update', (data) => {
      users = data.users || [];
      userCount = data.userCount || 0;
    });

    socket.on('negotiation-started', (data) => {
      isNegotiationActive = true;
      currentNegotiation = {
        proposer: data.proposer,
        proposal: data.proposal,
        proposalId: data.proposalId,
        votes: new Map(),
        hasVoted: false
      };
      
      const systemMessage = {
        id: Date.now(),
        type: 'negotiation-start',
        message: `${data.proposer} started a negotiation: "${data.proposal}"`,
        timestamp: new Date()
      };
      messages = [...messages, systemMessage];
      scrollToBottom();
    });

    socket.on('vote-cast', (data) => {
      if (currentNegotiation) {
        currentNegotiation.votes.set(data.username, data.vote);
        
        const systemMessage = {
          id: Date.now(),
          type: 'vote',
          message: `${data.username} voted ${data.vote}`,
          timestamp: new Date()
        };
        messages = [...messages, systemMessage];
        scrollToBottom();
      }
    });

    socket.on('negotiation-completed', (data) => {
      isNegotiationActive = false;
      
      const systemMessage = {
        id: Date.now(),
        type: 'negotiation-end',
        message: `Negotiation ${data.result}! Votes: ${data.votes.approve} approve, ${data.votes.reject} reject`,
        timestamp: new Date()
      };
      messages = [...messages, systemMessage];
      currentNegotiation = null;
      scrollToBottom();
    });
  }

  function removeSocketListeners() {
    socket.off('message-history');
    socket.off('new-message');
    socket.off('user-joined');
    socket.off('user-left');
    socket.off('room-update');
    socket.off('negotiation-started');
    socket.off('vote-cast');
    socket.off('negotiation-completed');
  }

  function sendMessage() {
    if (!newMessage.trim() || !socket) return;

    socket.emit('send-message', {
      message: newMessage.trim(),
      type: 'text'
    });

    newMessage = '';
  }

  function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function startNegotiation() {
    if (!negotiationProposal.trim() || !socket) return;

    socket.emit('start-negotiation', {
      proposal: negotiationProposal.trim()
    });

    negotiationProposal = '';
    showNegotiationForm = false;
  }

  function vote(voteType) {
    if (!currentNegotiation || currentNegotiation.hasVoted || !socket) return;

    socket.emit('vote', {
      proposalId: currentNegotiation.proposalId,
      vote: voteType
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
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  function getMessageClass(message) {
    if (message.type === 'system') return 'system-message';
    if (message.type === 'negotiation-start') return 'negotiation-message';
    if (message.type === 'negotiation-end') return 'negotiation-end-message';
    if (message.type === 'vote') return 'vote-message';
    if (message.username === config.username) return 'own-message';
    return 'other-message';
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
        <button class="negotiate-btn" onclick={() => showNegotiationForm = !showNegotiationForm}>
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
          <button onclick={() => showNegotiationForm = false}>Cancel</button>
          <button onclick={startNegotiation} disabled={!negotiationProposal.trim()}>
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
            <button class="approve-btn" onclick={() => vote('approve')}>
              ✅ Approve
            </button>
            <button class="reject-btn" onclick={() => vote('reject')}>
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
        {#if message.type === 'text'}
          <div class="message-header">
            <span class="username">{message.username}</span>
            <span class="timestamp">{formatTime(message.timestamp)}</span>
          </div>
          <div class="message-content">{message.message}</div>
        {:else}
          <div class="system-content">
            <span class="system-icon">
              {#if message.type === 'negotiation-start'}🤝
              {:else if message.type === 'negotiation-end'}🏁
              {:else if message.type === 'vote'}🗳️
              {:else}ℹ️{/if}
            </span>
            {message.message}
            <span class="timestamp">{formatTime(message.timestamp)}</span>
          </div>
        {/if}
      </div>
    {/each}
  </div>

  <div class="message-input">
    <div class="input-container">
      <textarea 
        bind:value={newMessage}
        placeholder="Type your message..."
        rows="1"
        onkeypress={handleKeyPress}
      ></textarea>
      <button onclick={sendMessage} disabled={!newMessage.trim()}>
        📤
      </button>
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

  .system-message, .negotiation-message, .negotiation-end-message, .vote-message {
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

  .message-input {
    padding: 15px 20px;
    border-top: 1px solid #e1e5e9;
    background: white;
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
</style>
