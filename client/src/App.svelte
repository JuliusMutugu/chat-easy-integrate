<script>
  import { onMount } from "svelte";
  import MessagingModule from "./lib/MessagingModule.svelte";
  import { toggleTheme, getTheme, isSoundEnabled, setSoundEnabled, playClick, playSuccess, playOpen } from "./lib/theme.js";

  let showModule = false;
  let config = {
    serverUrl: "http://localhost:3000",
    username: "User" + Math.floor(Math.random() * 1000),
    theme: "modern",
  };
  let inviteRoom = null;
  let inviteToken = null;
  let quickJoinCode = "";
  let darkMode = false;
  let soundOn = false;
  let sectionObserver = null;

  onMount(() => {
    darkMode = document.documentElement.getAttribute("data-theme") === "dark";
    soundOn = isSoundEnabled();

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
      handleInviteToken(inviteToken);
    } else if (roomId && isInvite) {
      handleInviteLink(roomId);
    }

    sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-visible", "true");
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => sectionObserver.observe(el));

    return () => {
      sectionObserver?.disconnect();
    };
  });

  function handleThemeClick() {
    toggleTheme();
    darkMode = document.documentElement.getAttribute("data-theme") === "dark";
    playClick();
  }

  function handleSoundClick() {
    setSoundEnabled(!soundOn);
    soundOn = !soundOn;
    if (soundOn) playSuccess();
  }

  async function handleInviteToken(token) {
    try {
      const response = await fetch(
        `${config.serverUrl}/api/rooms/invite/${token}`
      );
      if (response.ok) {
        inviteRoom = await response.json();
        inviteToken = token;
        showModule = true;
      } else {
        alert("Invalid or expired invitation link.");
      }
    } catch (error) {
      alert("Failed to load room from invitation link.");
    }
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  async function handleInviteLink(roomId) {
    try {
      const response = await fetch(`${config.serverUrl}/api/rooms/${roomId}`);
      if (response.ok) {
        inviteRoom = await response.json();
        showModule = true;
      } else {
        alert("Invitation link is invalid or room no longer exists.");
      }
    } catch (error) {
      alert("Failed to load room from invitation link.");
    }
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  function toggleModule() {
    showModule = !showModule;
    inviteRoom = null;
    inviteToken = null;
    if (showModule) playOpen();
    else playClick();
  }

  function handleClose() {
    showModule = false;
    inviteRoom = null;
    inviteToken = null;
    playClick();
  }

  async function handleQuickJoin() {
    if (!quickJoinCode) return;
    try {
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
        showModule = true;
        quickJoinCode = "";
        playSuccess();
      } else {
        alert("Room code not found. Please check the code and try again.");
      }
    } catch (error) {
      alert("Failed to join room. Please try again.");
    }
  }
</script>

{#if showModule}
  <div class="app-full">
    <MessagingModule {config} {inviteRoom} {inviteToken} onClose={handleClose} />
  </div>
{:else}
<main class="landing">
  <header class="nav">
    <div class="nav-inner">
      <button type="button" class="nav-logo" onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Messaging</button>
      <nav class="nav-links" aria-label="Main">
        <a href="#features" class="nav-link">Features</a>
        <a href="#built" class="nav-link">What's live</a>
        <a href="#coming" class="nav-link">Coming next</a>
        <a href="#pricing" class="nav-link">Pricing</a>
        <button type="button" class="nav-link nav-link-btn" onclick={() => { playClick(); toggleModule(); }}>
          Dashboard
        </button>
      </nav>
      <div class="nav-actions">
        <button
          type="button"
          class="nav-btn nav-btn-ghost nav-dashboard-mobile"
          onclick={() => { playClick(); toggleModule(); }}
          aria-label="Open dashboard"
        >
          Dashboard
        </button>
        <button
          type="button"
          class="nav-btn nav-btn-ghost"
          onclick={handleSoundClick}
          title={soundOn ? "Disable sound" : "Enable sound"}
          aria-pressed={soundOn}
        >
          {soundOn ? "Sound on" : "Sound off"}
        </button>
        <button
          type="button"
          class="nav-btn nav-btn-icon"
          onclick={handleThemeClick}
          title={darkMode ? "Switch to light" : "Switch to dark"}
          aria-label={darkMode ? "Switch to light theme" : "Switch to dark theme"}
        >
          {#if darkMode}
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          {:else}
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          {/if}
        </button>
        <button type="button" class="nav-btn nav-btn-primary" onclick={toggleModule}>
          Start messaging
        </button>
      </div>
    </div>
  </header>

  <section class="hero">
    <div class="hero-bg">
      <div class="hero-gradient"></div>
      <div class="hero-pattern" aria-hidden="true"></div>
      <div class="hero-image" aria-hidden="true"></div>
    </div>
    <div class="hero-inner">
      <div class="hero-content">
        <div class="hero-text">
          <h1 class="hero-title">Deal-ready messaging</h1>
          <p class="hero-subtitle">
            Live terms, audit trail, and omnichannel—Email, SMS, WhatsApp from one platform. No Twilio lock-in.
          </p>
          <div class="hero-pills">
            <span class="pill">Live deal block</span>
            <span class="pill">Audit trail</span>
            <span class="pill">Integrations</span>
            <span class="pill">Custom snippets</span>
          </div>
          <div class="hero-actions">
            <button class="btn-primary focus-ring" onclick={toggleModule}>
              Start messaging
            </button>
            <div class="quick-join">
              <input
                type="number"
                bind:value={quickJoinCode}
                placeholder="Enter 6-digit room code"
                class="code-input"
                min="100000"
                max="999999"
                onkeypress={(e) => e.key === "Enter" && handleQuickJoin()}
              />
              <button
                class="btn-join focus-ring"
                onclick={handleQuickJoin}
                disabled={!quickJoinCode}
              >
                Join
              </button>
            </div>
          </div>
        </div>
        <div class="hero-visual">
          <div class="chat-preview" data-animate>
            <div class="preview-bar">
              <div class="preview-dots">
                <span></span><span></span><span></span>
              </div>
              <span class="preview-label">Live demo</span>
            </div>
            <div class="preview-body">
              <div class="preview-deal-block">
                <strong>Current terms</strong> · Price 100 · Qty 1 · SLA 7 days · Tax 16%
              </div>
              <div class="preview-msg own">
                <span>Let's lock this. Deal terms shared.</span>
              </div>
              <div class="preview-msg other">
                <span>Agreed. I've approved the terms.</span>
              </div>
              <div class="preview-negotiation">
                <span>Negotiation: "Extend timeline by 2 weeks"</span>
                <div class="preview-votes">
                  <button type="button" class="vote-btn approve">Approve</button>
                  <button type="button" class="vote-btn reject">Reject</button>
                </div>
              </div>
              <div class="typing-preview">
                <div class="typing-dots">
                  <span></span><span></span><span></span>
                </div>
                <span>Others are typing...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section id="features" class="features" data-reveal>
    <div class="container">
      <h2 class="section-title reveal-title">Built for deals, not just chat</h2>
      <div class="feature-grid">
        <article class="feature-card" data-reveal data-reveal-delay="0">
          <div class="feature-icon-wrap">
            <span class="feature-icon" aria-hidden="true">Terms</span>
          </div>
          <h3>Live deal block</h3>
          <p>
            Pinned Current Terms: price, qty, SLA. Tax, shipping, margin recalc instantly (Svelte 5 runes). Share as a message widget.
          </p>
          <div class="feature-demo">
            <div class="demo-code">Price · Qty · SLA · Version history</div>
          </div>
        </article>
        <article class="feature-card" data-reveal data-reveal-delay="1">
          <div class="feature-icon-wrap">
            <span class="feature-icon" aria-hidden="true">Audit</span>
          </div>
          <h3>Audit trail</h3>
          <p>
            Who changed what, when—e.g. "User A changed price from $100 to $90 · 14:00 EAT." Compliance-ready.
          </p>
          <div class="feature-demo">
            <div class="demo-proposal">Timeline of term changes</div>
          </div>
        </article>
        <article class="feature-card" data-reveal data-reveal-delay="2">
          <div class="feature-icon-wrap">
            <span class="feature-icon" aria-hidden="true">Channels</span>
          </div>
          <h3>Integrations (our engine)</h3>
          <p>
            Email (SMTP), SMS (your gateway), WhatsApp (your API). No Twilio dependency. Configure once, send from the app.
          </p>
          <div class="feature-demo">
            <div class="demo-links">
              <span class="demo-link">Email</span>
              <span class="demo-link">SMS</span>
              <span class="demo-link">WhatsApp</span>
            </div>
          </div>
        </article>
        <article class="feature-card" data-reveal data-reveal-delay="3">
          <div class="feature-icon-wrap">
            <span class="feature-icon" aria-hidden="true">Invite</span>
          </div>
          <h3>Smart invitations</h3>
          <p>
            Creator-only invite; request-to-join with Accept/Decline. Pending requests in the nav. Room codes and links.
          </p>
          <div class="feature-demo">
            <div class="demo-code">Request → Creator notified → Accept/Decline</div>
          </div>
        </article>
        <article class="feature-card" data-reveal data-reveal-delay="4">
          <div class="feature-icon-wrap">
            <span class="feature-icon" aria-hidden="true">Snippets</span>
          </div>
          <h3>Custom snippets</h3>
          <p>
            Save reusable text in Settings. Insert from the chat input with one click—templates, greetings, clauses.
          </p>
          <div class="feature-demo">
            <div class="demo-code">Your phrases, one tap</div>
          </div>
        </article>
        <article class="feature-card" data-reveal data-reveal-delay="5">
          <div class="feature-icon-wrap">
            <span class="feature-icon" aria-hidden="true">Live</span>
          </div>
          <h3>Optimistic UI</h3>
          <p>
            Messages appear sent instantly. Syncs in background—built for patchy 4G/5G and low latency.
          </p>
          <div class="feature-demo">
            <div class="demo-users">
              <span class="user-dot online"></span>
              <span class="user-dot online"></span>
              <span class="user-dot typing"></span>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>

  <section id="built" class="built-section" data-reveal>
    <div class="container">
      <h2 class="section-title reveal-title">What’s live now</h2>
      <p class="built-lead">Everything below is implemented and available in the Dashboard.</p>
      <ul class="built-list">
        <li>Rooms, Create room, Join by code or invite link</li>
        <li>Request to join (invite link) → Creator gets Accept/Decline</li>
        <li>Pending requests (nav) + Version history (Deal block)</li>
        <li>Deal block: Current Terms (price, qty, SLA), tax/shipping/margin, Share as message</li>
        <li>Audit trail: deal_events API + timeline in room</li>
        <li>Settings: Enter to send, Custom snippets</li>
        <li>Integrations: Email (SMTP), SMS (your gateway), WhatsApp (your API)</li>
        <li>Optimistic messaging, @mentions, Reply, Creator remove member</li>
      </ul>
    </div>
  </section>

  <section id="coming" class="coming-section" data-reveal>
    <div class="container">
      <h2 class="section-title reveal-title">Coming next</h2>
      <p class="built-lead">Planned and on the roadmap.</p>
      <ul class="built-list coming-list">
        <li>Redlining lite (inline suggestions for contract text)</li>
        <li>Identity: IPRS (Kenya), Onfido / Stripe Identity</li>
        <li>M-Pesa (Daraja), Pesapal, Stripe, PayPal</li>
        <li>Smart invoicing (KRA / VAT on Accept)</li>
        <li>E-signatures in-app</li>
        <li>KDPP & GDPR (Right to be Forgotten, Data Residency)</li>
        <li>RBAC & approval workflows (Manager approves discount)</li>
      </ul>
    </div>
  </section>

  <section id="pricing" class="pricing" data-reveal>
    <div class="container">
      <h2 class="section-title reveal-title">Pricing</h2>
      <p class="pricing-lead">Simple plans for teams of any size.</p>
      <div class="pricing-grid">
        <article class="pricing-card" data-reveal data-reveal-delay="0">
          <h3 class="pricing-name">Free</h3>
          <div class="pricing-price">
            <span class="pricing-amount">$0</span>
            <span class="pricing-period">/ month</span>
          </div>
          <p class="pricing-desc">Get started with real-time messaging and group negotiations.</p>
          <ul class="pricing-features">
            <li>Up to 5 rooms</li>
            <li>Up to 10 users per room</li>
            <li>Real-time chat</li>
            <li>Group negotiations and voting</li>
            <li>Room codes and invite links</li>
          </ul>
          <button type="button" class="pricing-cta pricing-cta-ghost" onclick={toggleModule}>
            Get started
          </button>
        </article>
        <article class="pricing-card pricing-card-featured" data-reveal data-reveal-delay="1">
          <span class="pricing-badge">Popular</span>
          <h3 class="pricing-name">Pro</h3>
          <div class="pricing-price">
            <span class="pricing-amount">$12</span>
            <span class="pricing-period">/ month</span>
          </div>
          <p class="pricing-desc">For growing teams that need more rooms and capacity.</p>
          <ul class="pricing-features">
            <li>Unlimited rooms</li>
            <li>Up to 50 users per room</li>
            <li>Everything in Free</li>
            <li>Priority support</li>
            <li>Export and history</li>
          </ul>
          <button type="button" class="pricing-cta pricing-cta-primary" onclick={toggleModule}>
            Start free trial
          </button>
        </article>
        <article class="pricing-card" data-reveal data-reveal-delay="2">
          <h3 class="pricing-name">Team</h3>
          <div class="pricing-price">
            <span class="pricing-amount">$29</span>
            <span class="pricing-period">/ month</span>
          </div>
          <p class="pricing-desc">For organizations with advanced collaboration needs.</p>
          <ul class="pricing-features">
            <li>Everything in Pro</li>
            <li>Up to 100 users per room</li>
            <li>SSO and admin controls</li>
            <li>Dedicated support</li>
            <li>Custom integrations</li>
          </ul>
          <button type="button" class="pricing-cta pricing-cta-ghost" onclick={toggleModule}>
            Contact sales
          </button>
        </article>
      </div>
    </div>
  </section>

  <section class="config-block" data-reveal>
    <div class="container">
      <div class="config-card reveal-card" data-reveal>
        <h3>Quick setup</h3>
        <div class="config-grid">
          <div class="config-item">
            <label for="username">Your username</label>
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
              placeholder="http://localhost:3000"
            />
          </div>
        </div>
      </div>
    </div>
  </section>

</main>
{/if}

<style>
  .app-full {
    position: fixed;
    inset: 0;
    z-index: 100;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
  }

  .landing {
    width: 100%;
    min-height: 100vh;
    position: relative;
  }

  .nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
    background: var(--bg-primary);
    border-bottom: 1px solid var(--border);
    padding: 0.75rem 1.5rem;
    transition: background-color var(--duration-normal) var(--ease-in-out),
      border-color var(--duration-normal) var(--ease-in-out);
  }

  .nav-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1.5rem;
  }

  .nav-logo {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
    transition: color var(--duration-fast);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
  }

  .nav-logo:hover {
    color: var(--green-600);
  }

  .nav-logo:focus-visible {
    outline: 2px solid var(--green-500);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .nav-links {
    display: flex;
    gap: 1.5rem;
    align-items: center;
  }

  .nav-link {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-secondary);
    text-decoration: none;
    transition: color var(--duration-fast);
  }

  .nav-link:hover {
    color: var(--text-primary);
  }

  .nav-link-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    font-size: inherit;
    font-weight: inherit;
    font-family: inherit;
    color: inherit;
  }

  .nav-link-btn:focus-visible {
    outline: 2px solid var(--green-500);
    outline-offset: 2px;
    border-radius: 4px;
  }

  .nav-btn-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
    min-width: 2.25rem;
  }

  .nav-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .nav-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .nav-btn {
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
    transition: background-color var(--duration-fast), border-color var(--duration-fast),
      color var(--duration-fast), transform var(--duration-fast) var(--ease-spring);
  }

  .nav-btn-ghost {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-secondary);
  }

  .nav-btn-ghost:hover {
    background: var(--bg-secondary);
    border-color: var(--gray-300);
    color: var(--text-primary);
    transform: translateY(-1px);
  }

  .nav-btn-primary {
    background: var(--green-600);
    border: none;
    color: var(--white);
  }

  .nav-btn-primary:hover {
    background: var(--green-700);
    transform: translateY(-1px);
  }

  .nav-btn:focus-visible {
    outline: 2px solid var(--green-500);
    outline-offset: 2px;
  }

  :global([data-theme="dark"]) .nav-btn-ghost:hover {
    background: var(--gray-100);
    border-color: var(--gray-200);
  }

  /* Pricing */
  .pricing {
    padding: 5rem 1.5rem;
    background: var(--bg-secondary);
    transition: background-color var(--duration-normal) var(--ease-in-out);
  }

  .pricing-lead {
    text-align: center;
    font-size: 1.0625rem;
    color: var(--text-secondary);
    margin: -1.5rem 0 3rem;
    max-width: 480px;
    margin-left: auto;
    margin-right: auto;
  }

  .pricing-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1.5rem;
    max-width: 960px;
    margin: 0 auto;
  }

  .pricing-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 2rem;
    position: relative;
    transition: transform var(--duration-slow) var(--ease-spring),
      box-shadow var(--duration-normal) var(--ease-out-expo),
      border-color var(--duration-normal),
      background-color var(--duration-normal);
  }

  .pricing-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 16px 40px rgba(13, 33, 55, 0.08);
    border-color: var(--gray-300);
  }

  .pricing-card-featured {
    border-color: var(--green-500);
    box-shadow: 0 8px 32px rgba(64, 145, 108, 0.15);
  }

  .pricing-card-featured:hover {
    border-color: var(--green-600);
    box-shadow: 0 20px 48px rgba(64, 145, 108, 0.2);
  }

  .pricing-badge {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--green-600);
    color: var(--white);
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.75rem;
    border-radius: 999px;
  }

  .pricing-name {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }

  .pricing-price {
    margin-bottom: 1rem;
  }

  .pricing-amount {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  .pricing-period {
    font-size: 0.9375rem;
    color: var(--text-secondary);
    font-weight: 400;
  }

  .pricing-desc {
    font-size: 0.9375rem;
    color: var(--text-secondary);
    line-height: 1.5;
    margin-bottom: 1.5rem;
  }

  .pricing-features {
    list-style: none;
    padding: 0;
    margin: 0 0 1.5rem;
  }

  .pricing-features li {
    font-size: 0.9375rem;
    color: var(--text-primary);
    padding: 0.375rem 0;
    padding-left: 1.5rem;
    position: relative;
  }

  .pricing-features li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0.75rem;
    width: 6px;
    height: 6px;
    background: var(--green-600);
    border-radius: 50%;
  }

  .pricing-cta {
    width: 100%;
    padding: 0.75rem 1.25rem;
    border-radius: 10px;
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: background-color var(--duration-fast), border-color var(--duration-fast),
      transform var(--duration-fast) var(--ease-spring);
  }

  .pricing-cta-ghost {
    background: var(--bg-secondary);
    border: 2px solid var(--border);
    color: var(--text-primary);
  }

  .pricing-cta-ghost:hover {
    border-color: var(--green-500);
    background: var(--green-100);
    color: var(--green-800);
    transform: translateY(-1px);
  }

  .pricing-cta-primary {
    background: var(--green-600);
    border: none;
    color: var(--white);
  }

  .pricing-cta-primary:hover {
    background: var(--green-700);
    transform: translateY(-1px);
  }

  /* Hero */
  .hero {
    position: relative;
    min-height: 90vh;
    display: flex;
    align-items: center;
    padding: 5rem 1.5rem 4rem;
    overflow: hidden;
  }

  .hero-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
  }

  .hero-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--navy-900) 0%, var(--navy-800) 50%, var(--navy-700) 100%);
  }

  .hero-pattern {
    position: absolute;
    inset: 0;
    opacity: 0.06;
    background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0z' fill='none'/%3E%3Cpath d='M20 20m-2 0a2 2 0 1 1 4 0a2 2 0 1 1 -4 0' fill='%23fff' fill-opacity='1'/%3E%3C/svg%3E");
  }

  .hero-image {
    position: absolute;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 45%;
    max-width: 560px;
    height: 70%;
    max-height: 420px;
    background: linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%);
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.08);
  }

  .hero-inner {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
  }

  .hero-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4rem;
    align-items: center;
  }

  .hero-text {
    color: var(--white);
  }

  .hero-title {
    font-size: clamp(2.25rem, 4vw, 3.5rem);
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.02em;
    margin-bottom: 1.25rem;
    opacity: 0;
    animation: fadeUp 0.8s var(--ease-out-expo) 0.1s forwards;
  }

  .hero-subtitle {
    font-size: 1.2rem;
    line-height: 1.5;
    opacity: 0.9;
    margin-bottom: 2rem;
    opacity: 0;
    animation: fadeUp 0.8s var(--ease-out-expo) 0.2s forwards;
  }

  .hero-pills {
    display: flex;
    gap: 1rem;
    margin-bottom: 2.5rem;
    flex-wrap: wrap;
    opacity: 0;
    animation: fadeUp 0.8s var(--ease-out-expo) 0.3s forwards;
  }

  .pill {
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.2);
    padding: 0.5rem 1rem;
    border-radius: 999px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .hero-actions {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    opacity: 0;
    animation: fadeUp 0.8s var(--ease-out-expo) 0.4s forwards;
  }

  .btn-primary {
    background: var(--green-600);
    color: var(--white);
    border: none;
    padding: 1rem 2rem;
    border-radius: 10px;
    font-size: 1.0625rem;
    font-weight: 600;
    cursor: pointer;
    transition: transform var(--duration-normal) var(--ease-spring),
      box-shadow var(--duration-normal) var(--ease-out-expo),
      background-color var(--duration-fast);
    font-family: inherit;
  }

  .btn-primary:hover {
    background: var(--green-700);
    transform: translateY(-2px);
    box-shadow: 0 12px 28px rgba(45, 106, 79, 0.35);
  }

  .btn-primary:active {
    transform: translateY(0);
  }

  .quick-join {
    display: flex;
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.08);
    padding: 0.5rem;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .code-input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--white);
    padding: 0.75rem 1.25rem;
    border-radius: 8px;
    font-size: 1rem;
    outline: none;
    font-family: inherit;
  }

  .code-input::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }

  .btn-join {
    background: var(--green-600);
    border: none;
    color: var(--white);
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9375rem;
    transition: background-color var(--duration-fast), opacity var(--duration-fast);
    font-family: inherit;
  }

  .btn-join:hover:not(:disabled) {
    background: var(--green-700);
  }

  .btn-join:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .hero-visual {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .chat-preview {
    background: var(--white);
    border-radius: 16px;
    box-shadow: 0 32px 64px rgba(0, 0, 0, 0.25);
    overflow: hidden;
    width: 100%;
    max-width: 380px;
    transform: translateY(24px) rotate(-1.5deg);
    opacity: 0;
    animation: cardIn 1s var(--ease-out-expo) 0.5s forwards;
  }

  .chat-preview:hover {
    transform: translateY(0) rotate(0) scale(1.02);
    box-shadow: 0 40px 80px rgba(0, 0, 0, 0.3);
    transition: transform 0.4s var(--ease-spring), box-shadow 0.4s var(--ease-out-expo);
  }

  .preview-bar {
    background: var(--navy-800);
    color: var(--white);
    padding: 1rem 1.25rem;
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .preview-dots {
    display: flex;
    gap: 6px;
  }

  .preview-dots span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.4);
  }

  .preview-label {
    font-weight: 600;
    font-size: 0.9375rem;
  }

  .preview-body {
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 280px;
  }

  .preview-msg {
    max-width: 85%;
    padding: 0.75rem 1rem;
    border-radius: 12px;
    font-size: 0.875rem;
    animation: msgIn 0.5s var(--ease-out-expo) backwards;
  }

  .preview-msg.own {
    align-self: flex-end;
    background: var(--navy-700);
    color: var(--white);
    animation-delay: 0.8s;
  }

  .preview-msg.other {
    align-self: flex-start;
    background: var(--gray-100);
    color: var(--gray-900);
    animation-delay: 1s;
  }

  .preview-negotiation {
    background: var(--green-100);
    color: var(--green-800);
    padding: 0.75rem 1rem;
    border-radius: 10px;
    font-size: 0.75rem;
    text-align: center;
    border: 1px solid var(--green-400);
    animation: msgIn 0.5s var(--ease-out-expo) 1.2s backwards;
  }

  .preview-votes {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
    justify-content: center;
  }

  .vote-btn {
    padding: 0.375rem 0.75rem;
    border: none;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: default;
    font-family: inherit;
  }

  .vote-btn.approve {
    background: var(--green-600);
    color: var(--white);
  }

  .vote-btn.reject {
    background: var(--gray-500);
    color: var(--white);
  }

  .typing-preview {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--gray-500);
    font-size: 0.75rem;
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

  @keyframes fadeUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes cardIn {
    from {
      opacity: 0;
      transform: translateY(24px) rotate(-1.5deg);
    }
    to {
      opacity: 1;
      transform: translateY(0) rotate(-1.5deg);
    }
  }

  @keyframes msgIn {
    from {
      opacity: 0;
      transform: scale(0.96);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  @keyframes typingBounce {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
    30% { transform: translateY(-4px); opacity: 1; }
  }

  /* Features - scroll reveal (data-visible set by Intersection Observer) */
  :global([data-reveal]) {
    opacity: 0;
    transform: translateY(24px);
    transition: opacity var(--duration-slower) var(--ease-out-expo),
      transform var(--duration-slower) var(--ease-out-expo);
  }

  :global([data-reveal][data-visible="true"]) {
    opacity: 1;
    transform: translateY(0);
  }

  :global([data-reveal][data-reveal-delay="0"][data-visible="true"]) { transition-delay: 0ms; }
  :global([data-reveal][data-reveal-delay="1"][data-visible="true"]) { transition-delay: 80ms; }
  :global([data-reveal][data-reveal-delay="2"][data-visible="true"]) { transition-delay: 160ms; }

  .features :global(.section-title.reveal-title) {
    opacity: 0;
    transform: translateY(16px);
    transition: opacity var(--duration-slow) var(--ease-out-expo),
      transform var(--duration-slow) var(--ease-out-expo);
  }

  .features:global([data-visible="true"]) .section-title.reveal-title {
    opacity: 1;
    transform: translateY(0);
  }

  .features {
    padding: 5rem 1.5rem;
    background: var(--bg-primary);
    transition: background-color var(--duration-normal) var(--ease-in-out);
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .section-title {
    text-align: center;
    font-size: clamp(1.75rem, 3vw, 2.25rem);
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 3rem;
    letter-spacing: -0.02em;
    transition: color var(--duration-normal) var(--ease-in-out);
  }

  .feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
  }

  .feature-card {
    background: var(--bg-secondary);
    padding: 2rem;
    border-radius: 16px;
    border: 1px solid var(--border);
    transition: transform var(--duration-slow) var(--ease-spring),
      box-shadow var(--duration-normal) var(--ease-out-expo),
      border-color var(--duration-normal),
      background-color var(--duration-normal),
      border-color var(--duration-normal);
  }

  .feature-card:hover {
    transform: translateY(-6px);
    box-shadow: 0 20px 40px rgba(13, 33, 55, 0.12);
    border-color: var(--green-400);
  }

  .feature-icon-wrap {
    margin-bottom: 1.25rem;
  }

  .feature-icon {
    display: inline-block;
    background: var(--navy-800);
    color: var(--white);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .feature-card h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 0.5rem;
  }

  .feature-card p {
    color: var(--text-secondary);
    font-size: 0.9375rem;
    line-height: 1.5;
    margin-bottom: 1.25rem;
  }

  .feature-demo {
    background: var(--card-bg);
    padding: 1rem;
    border-radius: 10px;
    border: 1px solid var(--border);
  }

  .demo-code {
    font-family: ui-monospace, monospace;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--navy-700);
    margin-bottom: 0.5rem;
  }

  .demo-links {
    display: flex;
    gap: 0.5rem;
  }

  .demo-link {
    background: var(--navy-100);
    color: var(--navy-700);
    padding: 0.375rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .demo-proposal {
    background: var(--green-100);
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    margin-bottom: 0.5rem;
    font-size: 0.8125rem;
    color: var(--green-800);
  }

  .demo-users {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .user-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .user-dot.online {
    background: var(--green-500);
  }

  .user-dot.typing {
    background: var(--navy-500);
    animation: pulse 1.5s var(--ease-out-expo) infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Config */
  .config-block {
    padding: 4rem 1.5rem;
    background: var(--navy-800);
    transition: background-color var(--duration-normal) var(--ease-in-out);
  }

  .config-card {
    background: var(--card-bg);
    color: var(--text-primary);
    padding: 2.5rem;
    border-radius: 16px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
    max-width: 640px;
    margin: 0 auto;
    transition: background-color var(--duration-normal) var(--ease-in-out),
      color var(--duration-normal) var(--ease-in-out),
      box-shadow var(--duration-normal) var(--ease-out-expo);
  }

  .config-card h3 {
    text-align: center;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 1.5rem;
  }

  .config-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1.25rem;
  }

  .config-item label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--text-secondary);
  }

  .config-item input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid var(--border);
    border-radius: 10px;
    font-size: 1rem;
    font-family: inherit;
    background: var(--input-bg);
    color: var(--text-primary);
    transition: border-color var(--duration-fast), background-color var(--duration-normal),
      color var(--duration-normal);
  }

  .config-item input:focus {
    outline: none;
    border-color: var(--green-600);
  }

  .config-item input::placeholder {
    color: var(--text-secondary);
    opacity: 0.8;
  }

  .nav-dashboard-mobile {
    display: none;
  }

  @media (max-width: 900px) {
    .nav-links {
      display: none;
    }

    .nav-dashboard-mobile {
      display: inline-flex;
    }
  }

  @media (max-width: 768px) {
    .nav {
      padding: 0.5rem 1rem;
    }

    .nav-actions {
      gap: 0.375rem;
    }

    .nav-btn {
      padding: 0.4rem 0.6rem;
      font-size: 0.8125rem;
    }

    .nav-btn-primary {
      padding: 0.4rem 0.75rem;
    }

    .pricing-grid {
      grid-template-columns: 1fr;
    }

    .hero-content {
      grid-template-columns: 1fr;
      gap: 3rem;
      text-align: center;
    }

    .hero-pills {
      justify-content: center;
    }

    .hero-actions {
      align-items: center;
    }

    .quick-join {
      max-width: 100%;
    }

    .chat-preview {
      max-width: 320px;
      margin: 0 auto;
    }

    .hero-image {
      display: none;
    }
  }

  @media (max-width: 480px) {
    .hero {
      padding: 3rem 1rem;
    }

    .hero-title {
      font-size: 1.875rem;
    }

    .hero-subtitle {
      font-size: 1rem;
    }

    .quick-join {
      flex-direction: column;
    }

    .btn-join {
      width: 100%;
    }
  }
</style>
