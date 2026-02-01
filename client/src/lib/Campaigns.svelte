<script>
  /**
   * Campaigns page – gather and manage new leads.
   * Create campaigns, view leads (rooms + pending requests), manage lifecycle.
   */
  import { playClick, playSuccess, safeParseJson } from "./theme.js";

  export let config = {};
  export let rooms = [];
  export let onBack = () => {};
  export let onJoinRoom = () => {};
  export let onAcceptRequest = () => {};
  export let onDeclineRequest = () => {};
  export let onRefresh = () => {};

  let campaigns = [];
  let selectedCampaignId = null;
  let campaignLeads = { rooms: [], pending: [] };
  let allLeads = { rooms: [], pending: [] };
  let viewMode = "campaigns"; // "campaigns" | "all-leads"
  let showCreateForm = false;
  let newCampaignName = "";
  let newCampaignDesc = "";
  let newCampaignSource = "manual";
  let creating = false;
  let loading = false;
  let error = "";
  let message = "";

  const LIFECYCLE_OPTIONS = [
    { value: "new_lead", label: "New Lead" },
    { value: "hot_lead", label: "Hot Lead" },
    { value: "payment", label: "Payment" },
    { value: "customer", label: "Customer" },
  ];

  async function loadCampaigns() {
    try {
      const res = await fetch(`${config.serverUrl}/api/campaigns`, { credentials: "include" });
      if (res.ok) {
        const d = await safeParseJson(res);
        campaigns = Array.isArray(d) ? d : [];
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function loadCampaignLeads() {
    if (!selectedCampaignId) return;
    loading = true;
    try {
      const res = await fetch(`${config.serverUrl}/api/campaigns/${selectedCampaignId}/leads`, { credentials: "include" });
      if (res.ok) {
        const d = await safeParseJson(res);
        campaignLeads = (d && typeof d === "object") ? { rooms: d.rooms || [], pending: d.pending || [] } : { rooms: [], pending: [] };
      }
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  async function loadAllLeads() {
    loading = true;
    try {
      const res = await fetch(`${config.serverUrl}/api/leads`, { credentials: "include" });
      if (res.ok) {
        const d = await safeParseJson(res);
        allLeads = (d && typeof d === "object") ? { rooms: d.rooms || [], pending: d.pending || [] } : { rooms: [], pending: [] };
      }
    } catch (e) {
      console.error(e);
    } finally {
      loading = false;
    }
  }

  async function createCampaign() {
    if (!newCampaignName.trim()) return;
    creating = true;
    error = "";
    try {
      const res = await fetch(`${config.serverUrl}/api/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newCampaignName.trim(),
          description: newCampaignDesc.trim() || null,
          source: newCampaignSource,
        }),
      });
      const data = await safeParseJson(res) || {};
      if (!res.ok) throw new Error(data.error || "Failed to create");
      campaigns = [data, ...campaigns];
      newCampaignName = "";
      newCampaignDesc = "";
      showCreateForm = false;
      playSuccess();
      message = "Campaign created.";
      setTimeout(() => (message = ""), 3000);
    } catch (e) {
      error = e.message || "Failed to create campaign";
    } finally {
      creating = false;
    }
  }

  async function addRoomToCampaign(roomId) {
    if (!selectedCampaignId) return;
    try {
      const res = await fetch(`${config.serverUrl}/api/rooms/${roomId}/meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ campaignId: selectedCampaignId }),
      });
      if (res.ok) {
        onRefresh?.();
        loadCampaignLeads();
        playSuccess();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function setLifecycle(roomId, stage) {
    try {
      const res = await fetch(`${config.serverUrl}/api/rooms/${roomId}/meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ lifecycleStage: stage }),
      });
      if (res.ok) {
        onRefresh?.();
        loadCampaignLeads();
        loadAllLeads();
        playSuccess();
      }
    } catch (e) {
      console.error(e);
    }
  }

  function formatDate(d) {
    if (!d) return "—";
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
    if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
    return new Date(d).toLocaleDateString([], { month: "short", day: "numeric" });
  }

  function getLifecycleLabel(stage) {
    return LIFECYCLE_OPTIONS.find((o) => o.value === stage)?.label || stage || "—";
  }

  $: displayLeads = viewMode === "all-leads" ? allLeads : campaignLeads;
  $: selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);
</script>

<div class="campaigns-view">
  <header class="campaigns-header">
    <button type="button" class="btn-back" onclick={() => { playClick(); onBack(); }}>Back</button>
    <h2 class="campaigns-title">Campaigns</h2>
  </header>

  <p class="campaigns-desc">Create campaigns to gather leads from your website, invite links, or widget. Manage and qualify new leads here.</p>

  {#if message}
    <div class="banner success" role="status">{message}</div>
  {/if}
  {#if error}
    <div class="banner err" role="alert">{error}</div>
  {/if}

  <div class="campaigns-toolbar">
    <div class="campaigns-tabs">
      <button type="button" class="tab" class:active={viewMode === "campaigns"} onclick={() => { playClick(); viewMode = "campaigns"; selectedCampaignId = null; }}>
        Campaigns
      </button>
      <button type="button" class="tab" class:active={viewMode === "all-leads"} onclick={() => { playClick(); viewMode = "all-leads"; loadAllLeads(); }}>
        All leads
      </button>
    </div>
    <button type="button" class="btn-create" onclick={() => { playClick(); showCreateForm = !showCreateForm; }} disabled={viewMode !== "campaigns"}>
      New campaign
    </button>
  </div>

  {#if showCreateForm}
    <section class="campaign-create-section">
      <h3 class="section-title">Create campaign</h3>
      <div class="form">
        <label for="campaign-name">Name</label>
        <input id="campaign-name" type="text" bind:value={newCampaignName} placeholder="e.g. Summer 2025, Website widget" />
        <label for="campaign-desc">Description (optional)</label>
        <input id="campaign-desc" type="text" bind:value={newCampaignDesc} placeholder="Brief description" />
        <label for="campaign-source">Source</label>
        <select id="campaign-source" bind:value={newCampaignSource}>
          <option value="manual">Manual</option>
          <option value="widget">Website widget</option>
          <option value="invite">Invite link</option>
          <option value="form">Form / Landing page</option>
        </select>
        <div class="form-actions">
          <button type="button" class="btn-cancel" onclick={() => { showCreateForm = false; newCampaignName = ""; newCampaignDesc = ""; }}>Cancel</button>
          <button type="button" class="btn-save" disabled={creating || !newCampaignName.trim()} onclick={createCampaign}>{creating ? "Creating…" : "Create"}</button>
        </div>
      </div>
    </section>
  {/if}

  {#if viewMode === "campaigns"}
    <div class="campaigns-layout">
      <aside class="campaigns-sidebar">
        <h3 class="sidebar-title">Your campaigns</h3>
        {#if campaigns.length === 0}
          <p class="sidebar-empty">No campaigns yet. Create one to start gathering leads.</p>
        {:else}
          <ul class="campaign-list">
            {#each campaigns as camp (camp.id)}
              <li>
                <button
                  type="button"
                  class="campaign-item"
                  class:active={selectedCampaignId === camp.id}
                  onclick={async () => { playClick(); selectedCampaignId = camp.id; await loadCampaignLeads(); }}
                >
                  <span class="campaign-item-name">{camp.name}</span>
                  <span class="campaign-item-source">{camp.source}</span>
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </aside>

      <main class="campaigns-main">
        {#if selectedCampaignId}
          <div class="leads-header">
            <h3 class="leads-title">{selectedCampaign?.name} – Leads</h3>
            <button type="button" class="btn-refresh" onclick={() => loadCampaignLeads()} disabled={loading}>Refresh</button>
          </div>
          {#if loading}
            <p class="leads-loading">Loading…</p>
          {:else}
            <div class="leads-section">
              <h4 class="leads-subtitle">Pending requests ({campaignLeads.pending.length})</h4>
              {#if campaignLeads.pending.length === 0}
                <p class="leads-empty">No pending requests. Share your invite link or widget to gather leads.</p>
              {:else}
                <ul class="leads-list">
                  {#each campaignLeads.pending as req (req.requestId)}
                    <li class="lead-item lead-pending">
                      <div class="lead-info">
                        <strong>{req.requesterUsername}</strong> requested to join <strong>{req.roomName}</strong>
                        <span class="lead-date">{formatDate(req.createdAt)}</span>
                      </div>
                      <div class="lead-actions">
                        <button type="button" class="btn-decline" onclick={() => { playClick(); onDeclineRequest(req.requestId); }}>Decline</button>
                        <button type="button" class="btn-accept" onclick={() => { playClick(); onAcceptRequest(req.requestId); loadCampaignLeads(); }}>Accept</button>
                      </div>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>

            <div class="leads-section">
              <h4 class="leads-subtitle">Conversations ({campaignLeads.rooms.length})</h4>
              {#if campaignLeads.rooms.length === 0}
                <p class="leads-empty">No conversations yet. When you accept pending requests or add rooms to this campaign, they appear here.</p>
              {:else}
                <ul class="leads-list">
                  {#each campaignLeads.rooms as room (room.id)}
                    <li class="lead-item">
                      <button type="button" class="lead-row" onclick={() => { playClick(); onJoinRoom(room); }}>
                        <div class="lead-main">
                          <span class="lead-name">{room.name}</span>
                          <span class="lead-preview">{room.lastMessagePreview || room.description || "No messages"}</span>
                        </div>
                        <div class="lead-meta">
                          <span class="lead-lifecycle">{getLifecycleLabel(room.lifecycleStage)}</span>
                          <span class="lead-date">{formatDate(room.lastMessageAt || room.createdAt)}</span>
                        </div>
                      </button>
                      <div class="lead-actions-inline">
                        <select
                          class="lead-lifecycle-select"
                          value={room.lifecycleStage || ""}
                          onchange={(e) => setLifecycle(room.id, e.target.value || null)}
                          onclick={(e) => e.stopPropagation()}
                        >
                          <option value="">Set lifecycle</option>
                          {#each LIFECYCLE_OPTIONS as opt}
                            <option value={opt.value}>{opt.label}</option>
                          {/each}
                        </select>
                      </div>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>

            <div class="leads-section">
              <h4 class="leads-subtitle">Add room to campaign</h4>
              <p class="leads-hint">Select a room to link it to this campaign.</p>
              <select
                class="room-select"
                onchange={(e) => {
                  const roomId = e.target.value;
                  if (roomId) addRoomToCampaign(roomId);
                  e.target.value = "";
                }}
              >
                <option value="">Choose a room...</option>
                {#each rooms.filter((r) => r.campaignId !== selectedCampaignId) as room (room.id)}
                  <option value={room.id}>{room.name}</option>
                {/each}
              </select>
            </div>
          {/if}
        {:else}
          <div class="leads-placeholder">
            <p>Select a campaign to view and manage leads.</p>
          </div>
        {/if}
      </main>
    </div>
  {:else}
    <div class="campaigns-main campaigns-main-full">
      <div class="leads-header">
        <h3 class="leads-title">All leads</h3>
        <button type="button" class="btn-refresh" onclick={() => loadAllLeads()} disabled={loading}>Refresh</button>
      </div>
      {#if loading}
        <p class="leads-loading">Loading…</p>
      {:else}
        <div class="leads-section">
          <h4 class="leads-subtitle">Pending ({allLeads.pending.length})</h4>
          {#if allLeads.pending.length === 0}
            <p class="leads-empty">No pending requests.</p>
          {:else}
            <ul class="leads-list">
              {#each allLeads.pending as req (req.requestId)}
                <li class="lead-item lead-pending">
                  <div class="lead-info">
                    <strong>{req.requesterUsername}</strong> → <strong>{req.roomName}</strong>
                    <span class="lead-date">{formatDate(req.createdAt)}</span>
                  </div>
                  <div class="lead-actions">
                    <button type="button" class="btn-decline" onclick={() => { playClick(); onDeclineRequest(req.requestId); }}>Decline</button>
                    <button type="button" class="btn-accept" onclick={() => { playClick(); onAcceptRequest(req.requestId); loadAllLeads(); }}>Accept</button>
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        <div class="leads-section">
          <h4 class="leads-subtitle">Leads ({allLeads.rooms.length})</h4>
          {#if allLeads.rooms.length === 0}
            <p class="leads-empty">No leads yet. Create a campaign and add rooms, or share invite links.</p>
          {:else}
            <ul class="leads-list">
              {#each allLeads.rooms as room (room.id)}
                <li class="lead-item">
                  <button type="button" class="lead-row" onclick={() => { playClick(); onJoinRoom(room); }}>
                    <div class="lead-main">
                      <span class="lead-name">{room.name}</span>
                      <span class="lead-preview">{room.lastMessagePreview || "No messages"}</span>
                    </div>
                    <div class="lead-meta">
                      <span class="lead-lifecycle">{getLifecycleLabel(room.lifecycleStage)}</span>
                      <span class="lead-date">{formatDate(room.lastMessageAt || room.createdAt)}</span>
                    </div>
                  </button>
                  <select
                    class="lead-lifecycle-select"
                    value={room.lifecycleStage || ""}
                    onchange={(e) => setLifecycle(room.id, e.target.value || null)}
                    onclick={(e) => e.stopPropagation()}
                  >
                    <option value="">Set lifecycle</option>
                    {#each LIFECYCLE_OPTIONS as opt}
                      <option value={opt.value}>{opt.label}</option>
                    {/each}
                  </select>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .campaigns-view {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 1.5rem;
    overflow-y: auto;
  }

  .campaigns-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0.5rem;
  }

  .btn-back {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card-bg);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .btn-back:hover {
    background: var(--gray-50);
  }

  .campaigns-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--navy-900);
  }

  .campaigns-desc {
    margin: 0 0 1.25rem;
    font-size: 0.9375rem;
    color: var(--gray-600);
    line-height: 1.5;
  }

  .campaigns-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  .campaigns-tabs {
    display: flex;
    gap: 0.5rem;
  }

  .campaigns-tabs .tab {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card-bg);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .campaigns-tabs .tab.active {
    background: var(--navy-800);
    color: var(--white);
    border-color: var(--navy-800);
  }

  .btn-create {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 8px;
    background: var(--green-600);
    color: var(--white);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }

  .btn-create:hover:not(:disabled) {
    background: var(--green-700);
  }

  .btn-create:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .campaign-create-section {
    margin-bottom: 1.5rem;
    padding: 1.25rem;
    background: var(--gray-50);
    border: 1px solid var(--border);
    border-radius: 12px;
  }

  .section-title {
    margin: 0 0 1rem;
    font-size: 1rem;
    font-weight: 600;
  }

  .campaign-create-section .form label {
    display: block;
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .campaign-create-section .form input,
  .campaign-create-section .form select {
    width: 100%;
    max-width: 400px;
    padding: 0.5rem 0.75rem;
    margin-bottom: 1rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 0.9375rem;
  }

  .form-actions {
    display: flex;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .btn-cancel {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card-bg);
    font-size: 0.875rem;
    cursor: pointer;
    font-family: inherit;
  }

  .btn-save {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 8px;
    background: var(--green-600);
    color: var(--white);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }

  .btn-save:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .campaigns-layout {
    flex: 1;
    display: grid;
    grid-template-columns: 240px 1fr;
    gap: 1.5rem;
    min-height: 0;
  }

  .campaigns-sidebar {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1rem;
    background: var(--card-bg);
    overflow-y: auto;
  }

  .sidebar-title {
    margin: 0 0 0.75rem;
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .sidebar-empty {
    margin: 0;
    font-size: 0.875rem;
    color: var(--gray-500);
  }

  .campaign-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .campaign-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    padding: 0.75rem;
    border: none;
    border-radius: 8px;
    background: none;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
    margin-bottom: 0.25rem;
  }

  .campaign-item:hover {
    background: var(--gray-100);
  }

  .campaign-item.active {
    background: var(--navy-100);
    color: var(--navy-800);
  }

  .campaign-item-name {
    font-weight: 600;
    font-size: 0.9375rem;
  }

  .campaign-item-source {
    font-size: 0.75rem;
    color: var(--gray-500);
    text-transform: capitalize;
  }

  .campaigns-main {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.25rem;
    background: var(--card-bg);
    overflow-y: auto;
  }

  .campaigns-main-full {
    grid-column: 1 / -1;
  }

  .leads-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }

  .leads-title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .btn-refresh {
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--card-bg);
    font-size: 0.8125rem;
    cursor: pointer;
    font-family: inherit;
  }

  .leads-placeholder,
  .leads-loading,
  .leads-empty {
    margin: 2rem 0;
    font-size: 0.9375rem;
    color: var(--gray-500);
  }

  .leads-section {
    margin-bottom: 1.5rem;
  }

  .leads-subtitle {
    margin: 0 0 0.75rem;
    font-size: 0.9375rem;
    font-weight: 600;
  }

  .leads-hint {
    margin: 0 0 0.5rem;
    font-size: 0.8125rem;
    color: var(--gray-500);
  }

  .room-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 0.9375rem;
    max-width: 300px;
  }

  .leads-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .lead-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    margin-bottom: 0.5rem;
    background: var(--card-bg);
  }

  .lead-pending {
    background: var(--blue-50, #eff6ff);
    border-color: var(--blue-200, #bfdbfe);
  }

  .lead-row {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    font-family: inherit;
  }

  .lead-main {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .lead-name {
    font-weight: 600;
    font-size: 0.9375rem;
  }

  .lead-preview {
    font-size: 0.8125rem;
    color: var(--gray-600);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 280px;
  }

  .lead-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .lead-meta {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.8125rem;
  }

  .lead-lifecycle {
    padding: 0.2rem 0.5rem;
    background: var(--gray-100);
    border-radius: 4px;
    font-weight: 500;
  }

  .lead-date {
    color: var(--gray-500);
  }

  .lead-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-decline {
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--card-bg);
    font-size: 0.8125rem;
    cursor: pointer;
    font-family: inherit;
  }

  .btn-accept {
    padding: 0.375rem 0.75rem;
    border: none;
    border-radius: 6px;
    background: var(--green-600);
    color: var(--white);
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .lead-lifecycle-select {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.8125rem;
  }

  .banner.success { background: var(--green-100); color: var(--green-800); padding: 0.75rem 1rem; border-radius: 8px; }
  .banner.err { background: #fef2f2; color: #dc2626; padding: 0.75rem 1rem; border-radius: 8px; }

  @media (max-width: 768px) {
    .campaigns-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
