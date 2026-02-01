<script>
  import { onMount } from "svelte";
  import MessagingModule from "./lib/MessagingModule.svelte";
  import { toggleTheme, getTheme, playClick, playSuccess, playOpen } from "./lib/theme.js";

  let showModule = false;
  /** Paths that show the app (MessagingModule) instead of the landing page. Root / is always landing. */
  function isAppPath(path) {
    const p = (path || "").replace(/^\/+/, "");
    if (!p) return false;
    return p === "dashboard" || p === "workflows" || p.startsWith("workflows/") || p === "contacts" || p === "settings" || p === "integrations" || p === "create" || p === "pending" || p.startsWith("inbox");
  }
  function syncShowModuleFromUrl() {
    showModule = isAppPath(typeof window !== "undefined" ? window.location.pathname : "");
  }
  function onPopState() {
    syncShowModuleFromUrl();
  }
  let config = {
    serverUrl: "http://localhost:3000",
    username: "User" + Math.floor(Math.random() * 1000),
    theme: "modern",
  };
  let inviteRoom = null;
  let inviteToken = null;
  let quickJoinCode = "";
  let darkMode = false;
  let sectionObserver = null;
  let heroVideoEl = null;
  let heroVideoMuted = true;
  let autoScrollRafId = null;
  let autoScrollCancelled = false;

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function easeOutExpo(t) {
    return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  function startAutoScrollTour() {
    if (typeof window === "undefined" || showModule) return;
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    } catch (_) {}
    const startDelay = 2500;
    const scrollDownDuration = 2800;
    const pauseAtBottom = 400;
    const scrollUpDuration = 2800;
    const scrollTargetFraction = 1;

    let cancelled = false;
    const cancel = () => {
      cancelled = true;
      if (autoScrollRafId) cancelAnimationFrame(autoScrollRafId);
    };
    const onUserScroll = () => {
      cancel();
      window.removeEventListener("wheel", onUserScroll, { passive: true });
      window.removeEventListener("touchstart", onUserScroll, { passive: true });
      window.removeEventListener("keydown", onUserKeydown);
    };
    const onUserKeydown = (e) => {
      if (["Space", "ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(e.key)) cancel();
    };

    const run = () => {
      if (cancelled || showModule) return;
      const startY = window.scrollY;
      const maxScroll = (document.documentElement.scrollHeight - window.innerHeight) * scrollTargetFraction;
      const targetY = Math.max(0, maxScroll);
      const startTime = performance.now();

      const animateDown = (now) => {
        if (cancelled || showModule) return;
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / scrollDownDuration);
        const eased = easeOutExpo(t);
        window.scrollTo(0, startY + (targetY - startY) * eased);
        if (t < 1) autoScrollRafId = requestAnimationFrame(animateDown);
        else {
          autoScrollRafId = null;
          setTimeout(() => {
            if (cancelled || showModule) return;
            const backStartY = window.scrollY;
            const backStartTime = performance.now();
            const animateUp = (now2) => {
              if (cancelled || showModule) return;
              const elapsed2 = now2 - backStartTime;
              const t2 = Math.min(1, elapsed2 / scrollUpDuration);
              const eased2 = easeOutExpo(t2);
              window.scrollTo(0, backStartY * (1 - eased2));
              if (t2 < 1) autoScrollRafId = requestAnimationFrame(animateUp);
              else {
                autoScrollRafId = null;
                window.removeEventListener("wheel", onUserScroll, { passive: true });
                window.removeEventListener("touchstart", onUserScroll, { passive: true });
                window.removeEventListener("keydown", onUserKeydown);
              }
            };
            requestAnimationFrame(animateUp);
          }, pauseAtBottom);
        }
      };

      window.addEventListener("wheel", onUserScroll, { passive: true });
      window.addEventListener("touchstart", onUserScroll, { passive: true });
      window.addEventListener("keydown", onUserKeydown);
      requestAnimationFrame(animateDown);
    };

    setTimeout(run, startDelay);
  }

  function toggleHeroVideoMute() {
    if (!heroVideoEl) return;
    heroVideoMuted = !heroVideoMuted;
    heroVideoEl.muted = heroVideoMuted;
    playClick();
  }

  onMount(() => {
    darkMode = document.documentElement.getAttribute("data-theme") === "dark";
    syncShowModuleFromUrl();
    window.addEventListener("popstate", onPopState);

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

    startAutoScrollTour();

    return () => {
      window.removeEventListener("popstate", onPopState);
      sectionObserver?.disconnect();
      if (autoScrollRafId) cancelAnimationFrame(autoScrollRafId);
    };
  });

  function handleThemeClick() {
    toggleTheme();
    darkMode = document.documentElement.getAttribute("data-theme") === "dark";
    playClick();
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
        window.history.replaceState({}, document.title, "/dashboard");
      } else {
        alert("Invalid or expired invitation link.");
      }
    } catch (error) {
      alert("Failed to load room from invitation link.");
    }
  }

  async function handleInviteLink(roomId) {
    try {
      const response = await fetch(`${config.serverUrl}/api/rooms/${roomId}`);
      if (response.ok) {
        inviteRoom = await response.json();
        showModule = true;
        window.history.replaceState({}, document.title, "/dashboard");
      } else {
        alert("Invitation link is invalid or room no longer exists.");
      }
    } catch (error) {
      alert("Failed to load room from invitation link.");
    }
  }

  function toggleModule() {
    showModule = !showModule;
    inviteRoom = null;
    inviteToken = null;
    if (showModule) {
      window.history.pushState({}, document.title, "/dashboard");
      playOpen();
    } else {
      window.history.pushState({}, document.title, "/");
      playClick();
    }
  }

  function handleClose() {
    window.history.pushState({}, document.title, "/");
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
        window.history.pushState({}, document.title, "/dashboard");
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
      <button type="button" class="nav-logo brand-nego" onclick={() => { playClick(); toggleModule(); }} title="Home (your rooms)">
        <img src="/images/logo.jpg" alt="Nego" class="nav-logo-img" />
        <span class="nav-logo-text">Nego</span>
      </button>
      <nav class="nav-links" aria-label="Main">
        <button type="button" class="nav-link nav-link-btn" onclick={() => { playClick(); toggleModule(); }} title="Home – your rooms and messages">
          Home
        </button>
        <a href="#features" class="nav-link">Features</a>
        <a href="#pricing" class="nav-link">Pricing</a>
        <a href="#about" class="nav-link">About</a>
        <a href="#contact" class="nav-link">Contact us</a>
      </nav>
      <div class="nav-actions">
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
          Open <span class="brand-nego">Nego</span>
        </button>
      </div>
    </div>
  </header>

  <section class="hero">
    <div class="hero-bg">
      <div class="hero-gradient"></div>
      <div class="hero-pattern" aria-hidden="true"></div>
    </div>
    <div class="hero-inner">
      <div class="hero-content">
        <div class="hero-text">
          <h1 class="hero-title">
            <span class="hero-brand brand-nego">Nego</span>
            <span class="hero-tagline"> — deal-ready</span>
          </h1>
          <p class="hero-subtitle">
            Live terms, audit trail, and omnichannel—Email, SMS, WhatsApp from one platform. No lock-in.
          </p>
          <div class="hero-pills">
            <span class="pill">Deal terms & audit</span>
            <span class="pill">Redlining & e-sign</span>
            <span class="pill">M-Pesa · Stripe · PayPal</span>
            <span class="pill">Identity (KYC)</span>
            <span class="pill">Smart invoicing</span>
            <span class="pill">KDPP & GDPR</span>
          </div>
          <div class="hero-actions">
            <button class="btn-primary focus-ring" onclick={toggleModule}>
              Open <span class="brand-nego">Nego</span>
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
          <div class="hero-scroll-hint" aria-hidden="true">
            <span class="hero-scroll-hint-text">Scroll to explore</span>
            <span class="hero-scroll-hint-icon" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </div>
        </div>
        <div class="hero-visual">
          <div class="hero-video-wrap" data-animate>
            <video
              class="hero-video"
              src="/video/hero.mp4"
              poster="/images/nego.png"
              autoplay
              muted
              loop
              playsinline
              aria-label="Nego — deal-ready"
              bind:this={heroVideoEl}
            ></video>
            <button type="button" class="hero-video-unmute" onclick={toggleHeroVideoMute} aria-label={heroVideoMuted ? "Unmute video" : "Mute video"} title={heroVideoMuted ? "Unmute" : "Mute"}>
              {#if heroVideoMuted}
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              {/if}
            </button>
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

  <section id="about" class="features" data-reveal>
    <div class="container">
      <h2 class="section-title reveal-title">About</h2>
      <p class="pricing-lead" style="max-width: 56ch; margin-left: auto; margin-right: auto;">
        Nego is a deal-ready messaging platform. Live terms, audit trail, and omnichannel—Email, SMS, WhatsApp from one place. No lock-in.
      </p>
      <p class="pricing-lead" style="max-width: 56ch; margin: 0.5rem auto 0;">We focus on clarity: who said what, when, and what changed. Built for negotiations and deals, not just chat.</p>
    </div>
  </section>

  <section id="contact" class="pricing" data-reveal>
    <div class="container">
      <h2 class="section-title reveal-title">Contact us</h2>
      <p class="pricing-lead">Get in touch for support or sales.</p>
      <p class="pricing-lead" style="margin-top: 0.5rem; font-size: 0.9375rem;">
        Use the app to start a conversation, or reach out via your preferred channel.
      </p>
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

  /* Nego brand: same style everywhere — clean, white on dark, sans-serif, bold */
  .brand-nego {
    font-weight: 700;
    letter-spacing: -0.03em;
    font-family: inherit;
    text-transform: none;
  }

  .landing .nav {
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

  .landing .nav .nav-logo,
  .landing .nav .nav-link,
  .landing .nav .nav-link-btn {
    color: var(--text-primary);
  }

  .landing .nav .nav-link:hover,
  .landing .nav .nav-link-btn:hover {
    color: var(--green-600);
  }

  .landing .nav .nav-icon {
    color: var(--text-primary);
  }

  /* Dark theme: ensure logo and theme toggle are visible and high contrast */
  :global([data-theme="dark"]) .landing .nav {
    background: var(--bg-primary);
    border-bottom-color: var(--border);
  }
  :global([data-theme="dark"]) .landing .nav .nav-logo-img {
    filter: brightness(0) invert(1);
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
  }
  :global([data-theme="dark"]) .landing .nav .nav-logo-text,
  :global([data-theme="dark"]) .landing .nav .nav-link,
  :global([data-theme="dark"]) .landing .nav .nav-link-btn {
    color: var(--text-primary);
  }
  :global([data-theme="dark"]) .landing .nav .nav-btn-icon {
    color: var(--text-primary);
    background: var(--bg-secondary);
    border: 1px solid var(--border);
  }
  :global([data-theme="dark"]) .landing .nav .nav-btn-icon .nav-icon {
    color: inherit;
  }
  :global([data-theme="dark"]) .landing .nav .nav-btn-primary {
    background: var(--green-600);
    color: var(--bg-primary);
  }

  .nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 100;
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
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
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

  .nav-logo-img {
    width: 32px;
    height: 32px;
    min-width: 32px;
    min-height: 32px;
    object-fit: cover;
    flex-shrink: 0;
    border-radius: 50%;
  }

  .nav-logo-text {
    flex-shrink: 0;
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
    overflow-x: hidden;
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
    line-height: 1.1;
    margin-bottom: 1.25rem;
    opacity: 0;
    animation: fadeUp 0.65s cubic-bezier(0.16, 1, 0.3, 1) 0.1s forwards;
  }

  .hero-brand {
    display: block;
    font-size: 1em;
    color: var(--white);
  }

  .hero-tagline {
    font-weight: 600;
    letter-spacing: -0.02em;
    color: rgba(255, 255, 255, 0.92);
  }

  .hero-subtitle {
    font-size: 1.125rem;
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 1.5rem;
    opacity: 0;
    animation: fadeUp 0.65s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards;
  }

  .hero-pills {
    display: flex;
    gap: 0.5rem 0.75rem;
    margin-bottom: 1.75rem;
    flex-wrap: wrap;
    opacity: 0;
    animation: fadeUp 0.65s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
  }

  .pill {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.18);
    padding: 0.4rem 0.85rem;
    border-radius: 999px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.95);
  }

  .hero-actions {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    opacity: 0;
    animation: fadeUp 0.65s cubic-bezier(0.16, 1, 0.3, 1) 0.4s forwards;
  }

  .hero-scroll-hint {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1.5rem;
    padding: 0.5rem 1rem;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 999px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    opacity: 0;
    animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) 1s forwards, scrollHintBounce 1.8s cubic-bezier(0.34, 1.2, 0.64, 1) 2s ease-in-out infinite;
    will-change: transform;
  }

  .hero-scroll-hint-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    animation: scrollHintArrow 1.8s cubic-bezier(0.34, 1.2, 0.64, 1) 2s ease-in-out infinite;
    will-change: transform;
  }

  @keyframes scrollHintBounce {
    0%, 100% { transform: translateY(0) scale(1); opacity: 1; }
    45% { transform: translateY(5px) scale(1.02); opacity: 0.95; }
    55% { transform: translateY(5px) scale(1.02); opacity: 0.95; }
  }

  @keyframes scrollHintArrow {
    0%, 100% { transform: translateY(0); opacity: 1; }
    45% { transform: translateY(3px); opacity: 0.85; }
    55% { transform: translateY(3px); opacity: 0.85; }
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

  .btn-primary .brand-nego {
    color: inherit;
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
    width: 100%;
    min-height: 360px;
    overflow: visible;
  }

  .hero-video-wrap {
    position: relative;
    width: 100%;
    max-width: 720px;
    opacity: 0;
    animation: cardIn 0.75s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards;
    overflow: visible;
  }

  .hero-video {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 12px;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.1);
    object-fit: contain;
    background: rgba(0, 0, 0, 0.2);
  }

  .hero-video-unmute {
    position: absolute;
    bottom: 12px;
    right: 12px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: none;
    background: rgba(0, 0, 0, 0.6);
    color: var(--white);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease;
  }

  .hero-video-unmute:hover {
    background: rgba(0, 0, 0, 0.8);
  }

  @keyframes fadeUp {
    from {
      opacity: 0;
      transform: translateY(16px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes cardIn {
    from {
      opacity: 0;
      transform: translateY(20px) scale(0.97) rotate(-1deg);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1) rotate(-1deg);
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

  @media (max-width: 900px) {
    .nav-links {
      display: none;
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

    .hero-text {
      order: 1;
    }

    .hero-visual {
      order: 2;
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

    .hero-video-wrap {
      max-width: 100%;
      margin: 0 auto;
    }
  }

  @media (max-width: 480px) {
    .nav {
      padding: 0.5rem 0.75rem;
    }

    .nav-inner {
      gap: 0.5rem;
    }

    .nav-logo {
      font-size: 1rem;
    }

    .hero {
      padding: 3rem 1rem 2.5rem;
      min-height: auto;
    }

    .hero-title {
      font-size: 1.75rem;
    }

    .hero-subtitle {
      font-size: 0.9375rem;
    }

    .hero-pills {
      gap: 0.5rem;
    }

    .pill {
      font-size: 0.75rem;
      padding: 0.35rem 0.75rem;
    }

    .quick-join {
      flex-direction: column;
      width: 100%;
    }

    .btn-join {
      width: 100%;
    }

    .features {
      padding: 3rem 1rem;
    }

    .feature-grid {
      grid-template-columns: 1fr;
      gap: 1.25rem;
    }

    .feature-card {
      padding: 1.25rem;
    }

    .pricing {
      padding: 3rem 1rem;
    }

    .config-block {
      padding: 2.5rem 1rem;
    }

    .config-card {
      padding: 1.5rem;
    }
  }
</style>
