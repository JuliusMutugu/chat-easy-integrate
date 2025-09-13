<script>
  import { onMount } from "svelte";
  import MessagingModule from "./lib/MessagingModule.svelte";
  import { getServerUrl } from "./lib/config.js";

  let showModule = false;
  let config = {
    serverUrl: getServerUrl(),
    username: "User" + Math.floor(Math.random() * 1000),
    theme: "modern",
  };
  let inviteRoom = null;
  let isInvitedUser = false;
  let quickJoinCode = "";

  onMount(() => {
    // Check for invitation link in URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get("room");
    const isInvite = urlParams.get("invite");
    const inviteToken = urlParams.get("invite");
    const errorParam = urlParams.get("error");

    if (errorParam === "invalid-invite") {
      alert("Invalid or expired invitation link.");
      return;
    }

    if (inviteToken && inviteToken !== "true") {
      // New invite token system
      handleInviteToken(inviteToken);
    } else if (roomId && isInvite) {
      // Legacy invite system
      handleInviteLink(roomId);
    }
  });

  async function handleInviteToken(inviteToken) {
    try {
      const response = await fetch(
        `${config.serverUrl}/api/rooms/invite/${inviteToken}`
      );
      if (response.ok) {
        inviteRoom = await response.json();
        isInvitedUser = true;
        showModule = true;
      } else {
        alert("Invalid or expired invitation link.");
      }
    } catch (error) {
      alert("Failed to load room from invitation link.");
    }

    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  async function handleInviteLink(roomId) {
    try {
      const response = await fetch(`${config.serverUrl}/api/rooms/${roomId}`);
      if (response.ok) {
        inviteRoom = await response.json();
        isInvitedUser = true;
        showModule = true;
      } else {
        alert("Invitation link is invalid or room no longer exists.");
      }
    } catch (error) {
      alert("Failed to load room from invitation link.");
    }

    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  function toggleModule() {
    showModule = !showModule;
    inviteRoom = null; // Reset invite room when manually opening
    isInvitedUser = false; // Reset invited user status
  }

  function handleClose() {
    showModule = false;
    inviteRoom = null;
    isInvitedUser = false;
  }

  async function handleQuickJoin() {
    if (!quickJoinCode) return;

    try {
      // Convert to number for validation
      const roomCode = parseInt(quickJoinCode);
      if (isNaN(roomCode) || roomCode < 100000 || roomCode > 999999) {
        alert("Please enter a valid 6-digit room code.");
        return;
      }

      const response = await fetch(
        `${config.serverUrl}/api/rooms/code/${roomCode}`
      );
      if (response.ok) {
        const room = await response.json();
        inviteRoom = room;
        isInvitedUser = true;
        showModule = true;
        quickJoinCode = "";
      } else {
        alert("Room code not found. Please check the code and try again.");
      }
    } catch (error) {
      alert("Failed to join room. Please try again.");
    }
  }
</script>

<main>
  <div class="hero-section">
    <div class="hero-content">
      <div class="hero-text">
        <h1>💬 Connect & Negotiate</h1>
        <p class="hero-subtitle">
          Streamlining your negotiation and group decision making with ease
          (plan to automate the entire thing to work with any messaging app)
        </p>

        <div class="hero-stats">
          <div class="stat">
            <span class="stat-number">⚡</span>
            <span class="stat-label">Real-time</span>
          </div>
          <div class="stat">
            <span class="stat-number">🤝</span>
            <span class="stat-label">Negotiations</span>
          </div>
          <div class="stat">
            <span class="stat-number">📱</span>
            <span class="stat-label">Any Device</span>
          </div>
        </div>

        <div class="hero-actions">
          <button class="primary-btn" onclick={toggleModule}>
            Start Messaging
          </button>

          <div class="quick-join">
            <input
              type="number"
              bind:value={quickJoinCode}
              placeholder="Enter 6-digit room code..."
              class="code-input"
              min="100000"
              max="999999"
              onkeypress={(e) => e.key === "Enter" && handleQuickJoin()}
            />
            <button
              class="join-code-btn"
              onclick={handleQuickJoin}
              disabled={!quickJoinCode}
            >
              Join
            </button>
          </div>
        </div>
      </div>

      <div class="hero-visual">
        <div class="chat-preview">
          <div class="preview-header">
            <div class="preview-dots">
              <span></span><span></span><span></span>
            </div>
            <span class="preview-title">Live Demo</span>
          </div>
          <div class="preview-content">
            <div class="preview-message own">
              <span>Let's discuss the project timeline 📅</span>
            </div>
            <div class="preview-message other">
              <span>I propose we extend by 2 weeks 🤔</span>
            </div>
            <div class="preview-negotiation">
              <span>🤝 Negotiation started: "Extend timeline by 2 weeks"</span>
              <div class="preview-votes">
                <button class="vote-preview approve">✅ Approve</button>
                <button class="vote-preview reject">❌ Reject</button>
              </div>
            </div>
            <div class="typing-preview">
              <div class="typing-dots-preview">
                <span></span><span></span><span></span>
              </div>
              <span>Others are typing...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="features-section">
    <div class="container">
      <h2>✨ Why Choose Our Platform?</h2>

      <div class="feature-showcase">
        <div class="feature-highlight">
          <div class="feature-icon-large">📤</div>
          <h3>Smart Invitations</h3>
          <p>
            Share room codes, email invites, or social media links. Join with
            just a code!
          </p>
          <div class="feature-demo">
            <div class="demo-code">ABC123</div>
            <div class="demo-links">
              <span class="demo-link">📧</span>
              <span class="demo-link">💬</span>
              <span class="demo-link">✈️</span>
            </div>
          </div>
        </div>

        <div class="feature-highlight">
          <div class="feature-icon-large">🤝</div>
          <h3>Group Negotiations</h3>
          <p>
            Make decisions together with built-in voting system and real-time
            results.
          </p>
          <div class="feature-demo">
            <div class="demo-proposal">"Extend deadline by 1 week"</div>
            <div class="demo-votes">
              <span class="vote-result approve">3 ✅</span>
              <span class="vote-result reject">1 ❌</span>
            </div>
          </div>
        </div>

        <div class="feature-highlight">
          <div class="feature-icon-large">⚡</div>
          <h3>Real-time Everything</h3>
          <p>
            See typing indicators, live user presence, and instant message
            delivery.
          </p>
          <div class="feature-demo">
            <div class="demo-users">
              <div class="user-indicator online"></div>
              <div class="user-indicator online"></div>
              <div class="user-indicator typing"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="config-section">
    <div class="container">
      <div class="config-card">
        <h3>🔧 Quick Setup</h3>
        <div class="config-grid">
          <div class="config-item">
            <label for="username">Your Username</label>
            <input
              id="username"
              bind:value={config.username}
              placeholder="Enter your name"
            />
          </div>
          <div class="config-item">
            <label for="serverUrl">Server URL</label>
            <input
              id="serverUrl"
              bind:value={config.serverUrl}
              placeholder="https://chat-easy-integrate.onrender.com"
            />
          </div>
        </div>
      </div>
    </div>
  </div>

  {#if showModule}
    <MessagingModule {config} {inviteRoom} {isInvitedUser} onClose={handleClose} />
  {/if}
</main>

<style>
  main {
    width: 100%;
    min-height: 100vh;
  }

  /* Hero Section */
  .hero-section {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 80px 20px;
    position: relative;
    overflow: hidden;
  }

  .hero-section::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='6'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
    opacity: 0.3;
  }

  .hero-content {
    max-width: 1200px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 60px;
    align-items: center;
    position: relative;
    z-index: 1;
  }

  .hero-text h1 {
    font-size: 3.5em;
    margin: 0 0 20px 0;
    font-weight: 700;
    line-height: 1.1;
  }

  .hero-subtitle {
    font-size: 1.3em;
    margin-bottom: 40px;
    opacity: 0.9;
    line-height: 1.5;
  }

  .hero-stats {
    display: flex;
    gap: 30px;
    margin-bottom: 40px;
  }

  .stat {
    text-align: center;
  }

  .stat-number {
    display: block;
    font-size: 2em;
    margin-bottom: 5px;
  }

  .stat-label {
    font-size: 14px;
    opacity: 0.8;
    font-weight: 500;
  }

  .hero-actions {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .primary-btn {
    background: rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
    border: 2px solid rgba(255, 255, 255, 0.3);
    color: white;
    padding: 16px 32px;
    border-radius: 50px;
    font-size: 18px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
    text-align: center;
  }

  .primary-btn:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: translateY(-2px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  }

  .quick-join {
    display: flex;
    gap: 10px;
    background: rgba(255, 255, 255, 0.1);
    padding: 8px;
    border-radius: 50px;
    backdrop-filter: blur(10px);
  }

  .code-input {
    flex: 1;
    background: transparent;
    border: none;
    color: white;
    padding: 12px 20px;
    border-radius: 25px;
    font-size: 16px;
    outline: none;
  }

  .code-input::placeholder {
    color: rgba(255, 255, 255, 0.7);
  }

  .join-code-btn {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    padding: 12px 24px;
    border-radius: 25px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.3s;
  }

  .join-code-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.3);
  }

  .join-code-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Chat Preview */
  .hero-visual {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .chat-preview {
    background: white;
    border-radius: 20px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    overflow: hidden;
    width: 100%;
    max-width: 400px;
    transform: rotate(-2deg);
    transition: transform 0.3s;
  }

  .chat-preview:hover {
    transform: rotate(0deg) scale(1.02);
  }

  .preview-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 15px 20px;
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .preview-dots {
    display: flex;
    gap: 5px;
  }

  .preview-dots span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.7);
  }

  .preview-title {
    font-weight: 600;
  }

  .preview-content {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 15px;
    height: 300px;
    overflow: hidden;
  }

  .preview-message {
    max-width: 80%;
    padding: 10px 15px;
    border-radius: 15px;
    font-size: 14px;
    animation: slideIn 0.5s ease;
  }

  .preview-message.own {
    align-self: flex-end;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }

  .preview-message.other {
    align-self: flex-start;
    background: #f1f3f4;
    color: #333;
  }

  .preview-negotiation {
    background: #fff3e0;
    color: #e65100;
    padding: 12px;
    border-radius: 10px;
    font-size: 12px;
    text-align: center;
    border: 1px solid #ffcc02;
  }

  .preview-votes {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    justify-content: center;
  }

  .vote-preview {
    padding: 6px 12px;
    border: none;
    border-radius: 15px;
    font-size: 11px;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .vote-preview.approve {
    background: #4caf50;
    color: white;
  }

  .vote-preview.reject {
    background: #f44336;
    color: white;
  }

  .vote-preview:hover {
    transform: scale(1.05);
  }

  .typing-preview {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #666;
    font-size: 12px;
  }

  .typing-dots-preview {
    display: flex;
    gap: 2px;
  }

  .typing-dots-preview span {
    width: 3px;
    height: 3px;
    background: #667eea;
    border-radius: 50%;
    animation: typingPreview 1.4s ease-in-out infinite;
  }

  .typing-dots-preview span:nth-child(1) {
    animation-delay: 0s;
  }
  .typing-dots-preview span:nth-child(2) {
    animation-delay: 0.2s;
  }
  .typing-dots-preview span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes typingPreview {
    0%,
    60%,
    100% {
      transform: translateY(0);
      opacity: 0.4;
    }
    30% {
      transform: translateY(-4px);
      opacity: 1;
    }
  }

  /* Features Section */
  .features-section {
    padding: 80px 20px;
    background: linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%);
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .features-section h2 {
    text-align: center;
    font-size: 2.5em;
    margin-bottom: 60px;
    color: #333;
  }

  .feature-showcase {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 40px;
  }

  .feature-highlight {
    background: white;
    padding: 40px;
    border-radius: 20px;
    text-align: center;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
    transition: all 0.3s;
    border: 1px solid #e1e5e9;
  }

  .feature-highlight:hover {
    transform: translateY(-10px);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);
    border-color: #667eea;
  }

  .feature-icon-large {
    font-size: 4em;
    margin-bottom: 20px;
    display: block;
  }

  .feature-highlight h3 {
    font-size: 1.5em;
    margin-bottom: 15px;
    color: #333;
  }

  .feature-highlight p {
    color: #666;
    line-height: 1.6;
    margin-bottom: 25px;
  }

  .feature-demo {
    background: #f8f9fa;
    padding: 20px;
    border-radius: 12px;
    margin-top: 20px;
  }

  .demo-code {
    font-family: "Courier New", monospace;
    font-size: 1.5em;
    font-weight: bold;
    color: #667eea;
    margin-bottom: 10px;
  }

  .demo-links {
    display: flex;
    justify-content: center;
    gap: 10px;
  }

  .demo-link {
    background: #667eea;
    color: white;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
  }

  .demo-proposal {
    background: #fff3e0;
    padding: 10px;
    border-radius: 8px;
    margin-bottom: 10px;
    font-style: italic;
    color: #e65100;
  }

  .demo-votes {
    display: flex;
    justify-content: center;
    gap: 15px;
  }

  .vote-result {
    padding: 5px 10px;
    border-radius: 15px;
    font-size: 12px;
    font-weight: bold;
  }

  .vote-result.approve {
    background: #e8f5e8;
    color: #2e7d32;
  }

  .vote-result.reject {
    background: #ffebee;
    color: #c62828;
  }

  .demo-users {
    display: flex;
    justify-content: center;
    gap: 10px;
  }

  .user-indicator {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    position: relative;
  }

  .user-indicator.online {
    background: #4caf50;
  }

  .user-indicator.typing {
    background: #ff9800;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  /* Config Section */
  .config-section {
    padding: 60px 20px;
    background: #667eea;
  }

  .config-card {
    background: white;
    padding: 40px;
    border-radius: 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  }

  .config-card h3 {
    text-align: center;
    margin-bottom: 30px;
    color: #333;
    font-size: 1.5em;
  }

  .config-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
  }

  .config-item label {
    display: block;
    margin-bottom: 8px;
    font-weight: 600;
    color: #333;
  }

  .config-item input {
    width: 100%;
    padding: 12px 16px;
    border: 2px solid #e1e5e9;
    border-radius: 10px;
    font-size: 16px;
    transition: border-color 0.3s;
  }

  .config-item input:focus {
    outline: none;
    border-color: #667eea;
  }

  /* Responsive Design */
  @media (max-width: 768px) {
    .hero-content {
      grid-template-columns: 1fr;
      gap: 40px;
      text-align: center;
    }

    .hero-text h1 {
      font-size: 2.5em;
    }

    .hero-stats {
      justify-content: center;
    }

    .chat-preview {
      max-width: 300px;
    }

    .features-section {
      padding: 60px 20px;
    }

    .feature-showcase {
      grid-template-columns: 1fr;
      gap: 30px;
    }

    .feature-highlight {
      padding: 30px 20px;
    }

    .config-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 480px) {
    .hero-section {
      padding: 60px 15px;
    }

    .hero-text h1 {
      font-size: 2em;
    }

    .hero-subtitle {
      font-size: 1.1em;
    }

    .hero-stats {
      flex-direction: column;
      gap: 20px;
    }

    .primary-btn {
      padding: 14px 28px;
      font-size: 16px;
    }

    .quick-join {
      flex-direction: column;
      gap: 10px;
      padding: 15px;
      border-radius: 15px;
    }

    .code-input,
    .join-code-btn {
      border-radius: 10px;
    }
  }
</style>
