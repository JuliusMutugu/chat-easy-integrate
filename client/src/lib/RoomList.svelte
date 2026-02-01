<script>
  import { playClick, playSuccess } from "./theme.js";

  export let rooms = [];
  export const config = {};
  export let inviteRoom = null;
  export let inviteToken = null;
  export let onCreateRoom = () => {};
  export let onJoinRoom = () => {};
  export let onRequestJoin = () => {};
  export let onRefresh = () => {};

  let showInviteModal = false;
  let selectedRoom = null;
  let inviteEmail = "";
  let inviteLink = "";
  let searchQuery = "";
  let sortBy = "name";
  let showOptionsMenu = false;

  function formatTime(date) {
    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function showInvite(room) {
    selectedRoom = room;
    inviteLink =
      room.inviteLink ||
      `${window.location.origin}?room=${room.id}&invite=true`;
    showInviteModal = true;
  }

  async function generateNewInviteLink() {
    if (!selectedRoom) return;
    try {
      const response = await fetch(
        `${config.serverUrl}/api/rooms/${selectedRoom.id}/invite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invitedBy: config.username || "" }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        inviteLink = data.inviteLink;
        showToast("New invite link generated.");
      } else {
        const err = await response.json().catch(() => ({}));
        showToast(err.error || "Failed to generate new invite link.");
      }
    } catch (error) {
      showToast("Error generating invite link.");
    }
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(inviteLink);
    playSuccess();
    showToast("Invite link copied.");
  }

  function copyRoomCode() {
    navigator.clipboard.writeText(selectedRoom.code);
    playSuccess();
    showToast("Room code copied.");
  }

  function sendEmailInvite() {
    if (!inviteEmail.trim()) return;
    const subject = `Join ${selectedRoom.name} - Room Code: ${selectedRoom.code}`;
    const body = `You're invited to join "${selectedRoom.name}".

Quick join:
- Room Code: ${selectedRoom.code}
- Direct Link: ${inviteLink}

Description: ${selectedRoom.description}

How to join:
1. Visit the platform
2. Enter room code: ${selectedRoom.code}
3. Or use the direct link above.`;

    const mailtoLink = `mailto:${inviteEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoLink);
    inviteEmail = "";
    showInviteModal = false;
    showToast("Email invitation opened.");
  }

  function closeInviteModal() {
    showInviteModal = false;
    selectedRoom = null;
    inviteEmail = "";
    inviteLink = "";
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

  $: filteredAndSortedRooms = (() => {
    const q = searchQuery.trim().toLowerCase();
    let list = rooms;
    if (q) {
      list = rooms.filter(
        (r) =>
          (r.name && r.name.toLowerCase().includes(q)) ||
          (r.description && r.description.toLowerCase().includes(q)) ||
          (String(r.code) && String(r.code).includes(q))
      );
    }
    if (sortBy === "name") {
      return [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    if (sortBy === "code") {
      return [...list].sort((a, b) => (a.code || 0) - (b.code || 0));
    }
    return list;
  })();
</script>

<div class="room-list">
  <div class="list-header">
    <h3 class="list-title">Messaging</h3>
    <div class="list-actions">
      <div class="search-wrap">
        <input
          type="search"
          class="search-input"
          placeholder="Search rooms by name or code..."
          bind:value={searchQuery}
          aria-label="Search rooms"
        />
      </div>
      <div class="options-wrap">
        <button
          type="button"
          class="btn-icon btn-options"
          onclick={() => (showOptionsMenu = !showOptionsMenu)}
          aria-expanded={showOptionsMenu}
          aria-haspopup="true"
          aria-label="Options"
        >
          Options
        </button>
        {#if showOptionsMenu}
          <div class="options-dropdown" role="menu">
            <button type="button" class="options-item" role="menuitem" onclick={() => { sortBy = "name"; showOptionsMenu = false; }}>
              Sort by name
            </button>
            <button type="button" class="options-item" role="menuitem" onclick={() => { sortBy = "code"; showOptionsMenu = false; }}>
              Sort by code
            </button>
            <button type="button" class="options-item" role="menuitem" onclick={() => { playClick(); onRefresh(); showOptionsMenu = false; }}>
              Refresh list
            </button>
          </div>
        {/if}
      </div>
      <button type="button" class="btn-primary" onclick={() => { playClick(); onCreateRoom(); }}>Create room</button>
    </div>
  </div>

  {#if rooms.length === 0}
    <div class="empty">
      <div class="empty-icon" aria-hidden="true"></div>
      <h4>No rooms available</h4>
      <p>Create the first room to start.</p>
      <button type="button" class="btn-primary" onclick={onCreateRoom}>Create room</button>
    </div>
  {:else if filteredAndSortedRooms.length === 0}
    <div class="empty">
      <div class="empty-icon" aria-hidden="true"></div>
      <h4>No rooms match your search</h4>
      <p>Try a different search term or clear the search.</p>
      <button type="button" class="btn-primary" onclick={() => (searchQuery = "")}>Clear search</button>
    </div>
  {:else}
    {#if inviteRoom}
      <div class="invite-hero">
        <div class="invite-hero-inner">
          <div class="invite-hero-icon" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          </div>
          <h2 class="invite-hero-title">You're invited</h2>
          <p class="invite-hero-subtitle">Join <strong>{inviteRoom.name}</strong></p>
          {#if inviteRoom.description}
            <p class="invite-hero-desc">{inviteRoom.description}</p>
          {/if}
          <div class="invite-hero-meta">
            <span class="invite-hero-count">{inviteRoom.userCount} of {inviteRoom.maxUsers} online</span>
            {#if inviteRoom.userCount >= inviteRoom.maxUsers}
              <span class="invite-hero-full">Room full</span>
            {/if}
          </div>
          <div class="invite-hero-actions">
            {#if inviteToken}
              <button
                type="button"
                class="invite-cta invite-cta-request"
                disabled={inviteRoom.userCount >= inviteRoom.maxUsers}
                onclick={() => { playSuccess(); onRequestJoin(inviteToken); }}
              >
                <span class="invite-cta-label">Request to join</span>
                <span class="invite-cta-hint">Creator will approve your request</span>
              </button>
            {:else}
              <button
                type="button"
                class="invite-cta invite-cta-join"
                disabled={inviteRoom.userCount >= inviteRoom.maxUsers}
                onclick={() => { playSuccess(); onJoinRoom(inviteRoom); }}
              >
                Join now
              </button>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <div class="rooms-grid">
      {#each filteredAndSortedRooms as room}
        <article class="room-card" class:negotiating={room.isNegotiationActive}>
          <div class="card-top">
            <h4>{room.name}</h4>
            <div class="card-badges">
              {#if room.isNegotiationActive}
                <span class="badge negotiating">Negotiating</span>
              {/if}
              {#if room.createdByUsername === config.username}
                <button
                  type="button"
                  class="btn-icon small"
                  onclick={() => showInvite(room)}
                  title="Invite others (creator only)"
                  aria-label="Invite to room"
                >
                  Invite
                </button>
              {/if}
            </div>
          </div>
          <p class="card-desc">{room.description}</p>
          <div class="code-badge">
            <span class="code-label">Code</span>
            <span class="code-value">{room.code}</span>
          </div>
          <div class="card-meta">
            <span>{room.userCount}/{room.maxUsers} online</span>
            <span class="status-tag" class:full={room.userCount >= room.maxUsers}>
              {room.userCount >= room.maxUsers ? "Full" : "Available"}
            </span>
          </div>
          <div class="card-actions">
            <button
              type="button"
              class="btn-join"
              disabled={room.userCount >= room.maxUsers}
              onclick={() => { playClick(); onJoinRoom(room); }}
            >
              {room.userCount >= room.maxUsers ? "Room full" : "Join"}
            </button>
          </div>
        </article>
      {/each}
    </div>
  {/if}

  {#if showInviteModal && selectedRoom}
    <div
      class="modal-backdrop"
      role="presentation"
      onclick={closeInviteModal}
      onkeydown={(e) => e.key === 'Escape' && closeInviteModal()}
    >
      <div
        class="modal"
        role="dialog"
        tabindex="-1"
        aria-labelledby="invite-modal-title"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
      >
        <div class="modal-header">
          <h3 id="invite-modal-title">Invite to "{selectedRoom.name}"</h3>
          <button type="button" class="btn-icon close" onclick={closeInviteModal} aria-label="Close">Close</button>
        </div>

        <div class="modal-body">
          <section class="invite-section">
            <h4>Room code</h4>
            <div class="code-row">
              <div class="code-display">
                <span class="code-value">{selectedRoom.code}</span>
                <small>Share this code for easy access</small>
              </div>
              <button type="button" class="btn-secondary" onclick={copyRoomCode}>Copy code</button>
            </div>
          </section>

          <section class="invite-section">
            <h4>Direct link</h4>
            <div class="link-row">
              <input type="text" readonly value={inviteLink} class="link-input" />
              <button type="button" class="btn-secondary" onclick={copyInviteLink}>Copy link</button>
            </div>
            <div class="link-extra">
              <button type="button" class="btn-text" onclick={generateNewInviteLink}>Generate new link</button>
              <small>Use if the current link is compromised</small>
            </div>
          </section>

          <section class="invite-section">
            <h4>Email invitation</h4>
            <div class="email-row">
              <input
                type="email"
                bind:value={inviteEmail}
                placeholder="Enter email address"
                class="email-input"
              />
              <button
                type="button"
                class="btn-primary"
                onclick={sendEmailInvite}
                disabled={!inviteEmail.trim()}
              >
                Send
              </button>
            </div>
          </section>

          <section class="invite-section">
            <h4>Share</h4>
            <div class="share-row">
              <button
                type="button"
                class="btn-share"
                onclick={() =>
                  window.open(
                    `https://wa.me/?text=${encodeURIComponent(`Join "${selectedRoom.name}". Room Code: ${selectedRoom.code}. Link: ${inviteLink}`)}`
                  )}
              >
                WhatsApp
              </button>
              <button
                type="button"
                class="btn-share"
                onclick={() =>
                  window.open(
                    `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(`Join "${selectedRoom.name}". Code: ${selectedRoom.code}`)}`
                  )}
              >
                Telegram
              </button>
              <button
                type="button"
                class="btn-share"
                onclick={() =>
                  window.open(
                    `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Join "${selectedRoom.name}". Code: ${selectedRoom.code}`)}&url=${encodeURIComponent(inviteLink)}`
                  )}
              >
                Twitter
              </button>
            </div>
          </section>

          <section class="invite-section">
            <h4>Quick copy</h4>
            <div class="copy-row">
              <button
                type="button"
                class="btn-outline"
                onclick={() => {
                  navigator.clipboard.writeText(`Join "${selectedRoom.name}" - Room Code: ${selectedRoom.code}`);
                  showToast("Message copied.");
                }}
              >
                Simple message
              </button>
              <button
                type="button"
                class="btn-outline"
                onclick={() => {
                  navigator.clipboard.writeText(`You're invited to "${selectedRoom.name}". Code: ${selectedRoom.code}. Link: ${inviteLink}. ${selectedRoom.description}`);
                  showToast("Detailed message copied.");
                }}
              >
                Detailed message
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .room-list {
    padding: 1.5rem;
    height: 100%;
    overflow-y: auto;
  }

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .list-title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--navy-900);
  }

  .list-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }

  .search-wrap {
    flex: 1;
    min-width: 180px;
    max-width: 320px;
  }

  .search-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 2px solid var(--border);
    border-radius: 8px;
    font-size: 0.875rem;
    font-family: inherit;
    background: var(--input-bg);
    color: var(--text-primary);
    transition: border-color 0.15s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--green-600);
  }

  .search-input::placeholder {
    color: var(--text-secondary);
  }

  .options-wrap {
    position: relative;
  }

  .btn-options {
    white-space: nowrap;
  }

  .options-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 4px;
    min-width: 160px;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
    z-index: 20;
    padding: 0.25rem 0;
  }

  .options-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.5rem 1rem;
    border: none;
    background: none;
    color: var(--text-primary);
    font-size: 0.875rem;
    font-family: inherit;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .options-item:hover {
    background: var(--bg-secondary);
  }

  .btn-icon {
    background: var(--gray-100);
    border: 1px solid var(--border);
    color: var(--gray-700);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    font-family: inherit;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .btn-icon:hover {
    background: var(--gray-200);
    border-color: var(--gray-300);
  }

  .btn-icon.small {
    padding: 0.375rem 0.75rem;
    font-size: 0.8125rem;
  }

  .btn-primary {
    background: var(--green-600);
    color: var(--white);
    border: none;
    padding: 0.5rem 1.25rem;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9375rem;
    font-family: inherit;
    transition: background-color 0.15s ease, transform 0.2s var(--ease-spring);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--green-700);
    transform: translateY(-1px);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .empty {
    text-align: center;
    padding: 4rem 2rem;
    color: var(--gray-600);
  }

  .empty-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto 1.5rem;
    background: var(--gray-200);
    border-radius: 16px;
  }

  .empty h4 {
    margin: 0 0 0.5rem;
    font-size: 1.125rem;
    color: var(--navy-900);
  }

  .empty p {
    margin: 0 0 1.5rem;
    font-size: 0.9375rem;
  }

  .invite-hero {
    margin-bottom: 2rem;
    padding: 2rem;
    background: linear-gradient(135deg, var(--green-50) 0%, var(--navy-50) 100%);
    border: 1px solid var(--green-200);
    border-radius: 16px;
    box-shadow: 0 4px 24px rgba(45, 106, 79, 0.08);
  }

  .invite-hero-inner {
    max-width: 400px;
    margin: 0 auto;
    text-align: center;
  }

  .invite-hero-icon {
    width: 56px;
    height: 56px;
    margin: 0 auto 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--green-100);
    border-radius: 14px;
    color: var(--green-700);
  }

  .invite-hero-title {
    margin: 0 0 0.25rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--navy-900);
    letter-spacing: -0.02em;
  }

  .invite-hero-subtitle {
    margin: 0 0 0.5rem;
    font-size: 1.0625rem;
    color: var(--gray-700);
  }

  .invite-hero-subtitle strong {
    color: var(--navy-800);
  }

  .invite-hero-desc {
    margin: 0 0 1rem;
    font-size: 0.9375rem;
    color: var(--gray-600);
    line-height: 1.45;
  }

  .invite-hero-meta {
    margin-bottom: 1.5rem;
    font-size: 0.8125rem;
    color: var(--gray-500);
  }

  .invite-hero-full {
    display: inline-block;
    margin-left: 0.5rem;
    padding: 0.2rem 0.5rem;
    background: var(--gray-200);
    color: var(--gray-700);
    border-radius: 6px;
    font-weight: 600;
  }

  .invite-hero-actions {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: center;
  }

  .invite-cta {
    min-width: 220px;
    padding: 0.875rem 1.5rem;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1rem;
    font-family: inherit;
    cursor: pointer;
    border: none;
    transition: transform 0.2s var(--ease-spring), box-shadow 0.2s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .invite-cta:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .invite-cta-request {
    background: var(--green-600);
    color: var(--white);
    box-shadow: 0 4px 14px rgba(45, 106, 79, 0.35);
  }

  .invite-cta-request:hover:not(:disabled) {
    background: var(--green-700);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(45, 106, 79, 0.4);
  }

  .invite-cta-label {
    font-size: 1rem;
  }

  .invite-cta-hint {
    font-size: 0.75rem;
    font-weight: 500;
    opacity: 0.9;
  }

  .invite-cta-join {
    background: var(--navy-800);
    color: var(--white);
  }

  .invite-cta-join:hover:not(:disabled) {
    background: var(--navy-900);
    transform: translateY(-2px);
  }

  .rooms-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.25rem;
  }

  .room-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    transition: transform 0.25s var(--ease-spring), box-shadow 0.25s ease,
      border-color 0.2s ease, background-color var(--duration-normal) var(--ease-in-out);
    border-radius: 12px;
    padding: 1.25rem;
    transition: transform 0.25s var(--ease-spring), box-shadow 0.25s ease, border-color 0.2s ease;
  }

  .room-card:hover {
    border-color: var(--navy-500);
    box-shadow: 0 8px 24px rgba(13, 33, 55, 0.06);
    transform: translateY(-2px);
  }

  .room-card.negotiating {
    border-color: var(--green-400);
    background: var(--green-100);
  }

  .card-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.5rem;
    gap: 0.5rem;
  }

  .card-top h4 {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--navy-900);
    flex: 1;
  }

  .card-badges {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .badge {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    white-space: nowrap;
  }

  .badge.negotiating {
    background: var(--green-600);
    color: var(--white);
  }

  .card-desc {
    color: var(--gray-600);
    font-size: 0.875rem;
    line-height: 1.4;
    margin-bottom: 1rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .code-badge {
    background: var(--gray-50);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    margin-bottom: 1rem;
    text-align: center;
    font-size: 0.8125rem;
  }

  .code-label {
    color: var(--gray-600);
    margin-right: 0.375rem;
  }

  .code-value {
    font-family: ui-monospace, monospace;
    font-weight: 700;
    color: var(--navy-800);
    letter-spacing: 0.05em;
  }

  .card-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    font-size: 0.8125rem;
    color: var(--gray-600);
  }

  .status-tag {
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
    font-weight: 600;
    background: var(--green-100);
    color: var(--green-800);
  }

  .status-tag.full {
    background: var(--gray-200);
    color: var(--gray-700);
  }

  .card-actions {
    margin-top: 0;
  }

  .btn-join {
    width: 100%;
    background: var(--green-600);
    color: var(--white);
    border: none;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.9375rem;
    font-family: inherit;
    transition: background-color 0.15s ease, transform 0.2s var(--ease-spring);
  }

  .btn-join:hover:not(:disabled) {
    background: var(--green-700);
    transform: translateY(-1px);
  }

  .btn-join:disabled {
    background: var(--gray-300);
    cursor: not-allowed;
    transform: none;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: var(--overlay-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    padding: 1.5rem;
    animation: overlayIn 0.2s var(--ease-out-expo);
  }

  .modal {
    background: var(--bg-primary);
    border-radius: 16px;
    width: 100%;
    max-width: 480px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.2);
    animation: panelIn 0.3s var(--ease-out-expo);
  }

  .modal-header {
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--navy-800);
    color: var(--white);
    border-radius: 16px 16px 0 0;
  }

  .modal-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .btn-icon.close {
    background: rgba(255, 255, 255, 0.2);
    color: var(--white);
    border: none;
  }

  .btn-icon.close:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .modal-body {
    padding: 1.5rem;
  }

  .invite-section {
    margin-bottom: 1.5rem;
  }

  .invite-section:last-child {
    margin-bottom: 0;
  }

  .invite-section h4 {
    margin: 0 0 0.75rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--navy-900);
  }

  .code-row,
  .link-row,
  .email-row {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .code-display {
    flex: 1;
    text-align: center;
    padding: 1rem;
    background: var(--navy-800);
    border-radius: 10px;
    color: var(--white);
  }

  .code-display .code-value {
    display: block;
    font-size: 1.5rem;
    letter-spacing: 0.1em;
    margin-bottom: 0.25rem;
    color: var(--white);
  }

  .code-display small {
    font-size: 0.75rem;
    opacity: 0.9;
  }

  .link-input,
  .email-input {
    flex: 1;
    padding: 0.75rem 1rem;
    border: 2px solid var(--border);
    border-radius: 8px;
    font-size: 0.875rem;
    font-family: inherit;
    transition: border-color 0.15s ease;
  }

  .link-input:focus,
  .email-input:focus {
    outline: none;
    border-color: var(--green-600);
  }

  .btn-secondary {
    background: var(--navy-800);
    color: var(--white);
    border: none;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    font-family: inherit;
    transition: background-color 0.15s ease;
  }

  .btn-secondary:hover {
    background: var(--navy-900);
  }

  .link-extra {
    margin-top: 0.5rem;
    text-align: center;
  }

  .btn-text {
    background: none;
    border: none;
    color: var(--navy-600);
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 500;
    font-family: inherit;
    padding: 0.25rem 0;
  }

  .btn-text:hover {
    color: var(--navy-800);
    text-decoration: underline;
  }

  .link-extra small {
    display: block;
    color: var(--gray-500);
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }

  .share-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .btn-share {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--gray-50);
    color: var(--gray-800);
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 500;
    font-family: inherit;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .btn-share:hover {
    background: var(--gray-100);
    border-color: var(--gray-300);
  }

  .copy-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .btn-outline {
    flex: 1;
    min-width: 140px;
    background: var(--white);
    border: 2px solid var(--border);
    color: var(--navy-800);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    font-family: inherit;
    transition: border-color 0.15s ease, background-color 0.15s ease;
  }

  .btn-outline:hover {
    border-color: var(--green-600);
    background: var(--green-100);
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

  @keyframes overlayIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes panelIn {
    from {
      opacity: 0;
      transform: scale(0.96) translateY(12px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  @media (max-width: 768px) {
    .room-list {
      padding: 1rem;
    }

    .rooms-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .room-card {
      padding: 1rem;
    }

    .modal {
      margin: 0.5rem;
      max-width: calc(100% - 1rem);
    }

    .modal-body {
      padding: 1rem;
    }

    .code-row,
    .link-row,
    .email-row {
      flex-direction: column;
      align-items: stretch;
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
</style>
