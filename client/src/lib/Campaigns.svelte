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
  let viewMode = "campaigns"; // "campaigns" | "all-leads" | "analytics"
  let showCreateForm = false;
  let newCampaignName = "";
  let newCampaignDesc = "";
  let newCampaignSource = "manual";
  let creating = false;
  let loading = false;
  let error = "";
  let message = "";
  let showIcpPanel = false;
  let icp = { industry: "", companySize: "", role: "", needs: "", painPoints: "" };
  let icpSaving = false;
  let leadSort = "hot"; // hot | cool | newest | icp
  let leadFilter = "all"; // all | hot | warm | icp
  let analytics = { byCampaign: [], bySource: [] };
  let analyticsLoading = false;

  const LIFECYCLE_OPTIONS = [
    { value: "new_lead", label: "New Lead" },
    { value: "hot_lead", label: "Hot Lead" },
    { value: "payment", label: "Payment" },
    { value: "customer", label: "Customer" },
  ];

  const QUALIFICATION_OPTIONS = [
    { value: "", label: "—" },
    { value: "qualified", label: "Qualified" },
    { value: "needs_nurturing", label: "Needs nurturing" },
    { value: "not_fit", label: "Not a fit" },
  ];

  let similarLeads = [];
  let similarLoading = false;
  let nurtureRoom = null;
  let nurtureMessage = "";
  let nurtureSending = false;

  async function loadIcp() {
    try {
      const res = await fetch(`${config.serverUrl}/api/icp`, { credentials: "include" });
      if (res.ok) {
        const d = await safeParseJson(res);
        icp = d && typeof d === "object" ? { ...icp, ...d } : icp;
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function saveIcp() {
    icpSaving = true;
    error = "";
    try {
      const res = await fetch(`${config.serverUrl}/api/icp`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(icp),
      });
      const data = await safeParseJson(res) || {};
      if (!res.ok) throw new Error(data.error || "Failed to save");
      playSuccess();
      message = "Ideal customer profile saved.";
      setTimeout(() => (message = ""), 3000);
    } catch (e) {
      error = e.message || "Failed to save ICP";
    } finally {
      icpSaving = false;
    }
  }

  function getEngagementLabel(score) {
    if (score == null) return "";
    if (score >= 70) return "Hot";
    if (score >= 40) return "Warm";
    if (score >= 20) return "Cool";
    return "Cold";
  }

  function filterLeads(rooms) {
    if (!rooms || !Array.isArray(rooms)) return [];
    if (leadFilter === "all") return rooms;
    if (leadFilter === "hot") return rooms.filter((r) => r.engagementScore != null && r.engagementScore >= 70);
    if (leadFilter === "warm") return rooms.filter((r) => r.engagementScore != null && r.engagementScore >= 40);
    if (leadFilter === "icp") return rooms.filter((r) => r.icpFitScore != null && r.icpFitScore > 0);
    return rooms;
  }

  function sortLeads(rooms) {
    const list = [...(rooms || [])];
    if (leadSort === "hot") return list.sort((a, b) => (b.engagementScore ?? 0) - (a.engagementScore ?? 0));
    if (leadSort === "cool") return list.sort((a, b) => (a.engagementScore ?? 0) - (b.engagementScore ?? 0));
    if (leadSort === "newest") return list.sort((a, b) => {
      const at = a.lastMessageAt || a.createdAt;
      const bt = b.lastMessageAt || b.createdAt;
      return (bt ? new Date(bt).getTime() : 0) - (at ? new Date(at).getTime() : 0);
    });
    if (leadSort === "icp") return list.sort((a, b) => (b.icpFitScore ?? 0) - (a.icpFitScore ?? 0));
    return list;
  }

  $: filteredCampaignLeads = sortLeads(filterLeads(campaignLeads.rooms));
  $: filteredAllLeads = sortLeads(filterLeads(allLeads.rooms));

  async function loadAnalytics() {
    analyticsLoading = true;
    try {
      const res = await fetch(`${config.serverUrl}/api/campaigns/analytics`, { credentials: "include" });
      if (res.ok) {
        const d = await safeParseJson(res);
        analytics = d && typeof d === "object" ? { byCampaign: d.byCampaign || [], bySource: d.bySource || [] } : { byCampaign: [], bySource: [] };
      }
    } catch (e) {
      console.error(e);
    } finally {
      analyticsLoading = false;
    }
  }

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

  async function setQualification(roomId, status) {
    try {
      const res = await fetch(`${config.serverUrl}/api/rooms/${roomId}/meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ qualificationStatus: status || null }),
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

  async function setBestCustomer(roomId, value) {
    try {
      const res = await fetch(`${config.serverUrl}/api/rooms/${roomId}/meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isBestCustomer: !!value }),
      });
      if (res.ok) {
        onRefresh?.();
        loadCampaignLeads();
        loadAllLeads();
        playSuccess();
        if (value) loadSimilarLeads();
      }
    } catch (e) {
      console.error(e);
    }
  }

  async function loadSimilarLeads() {
    similarLoading = true;
    try {
      const res = await fetch(`${config.serverUrl}/api/leads/similar?limit=10`, { credentials: "include" });
      if (res.ok) {
        const d = await safeParseJson(res);
        similarLeads = Array.isArray(d) ? d : [];
      }
    } catch (e) {
      console.error(e);
    } finally {
      similarLoading = false;
    }
  }

  async function sendNurtureMessage() {
    if (!nurtureRoom?.id || !nurtureMessage.trim()) return;
    nurtureSending = true;
    error = "";
    try {
      const res = await fetch(`${config.serverUrl}/api/rooms/${nurtureRoom.id}/nurture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: nurtureMessage.trim() }),
      });
      const data = await safeParseJson(res) || {};
      if (!res.ok) throw new Error(data.error || "Failed to send");
      nurtureRoom = null;
      nurtureMessage = "";
      playSuccess();
      message = "Message sent.";
      setTimeout(() => (message = ""), 3000);
      onRefresh?.();
      loadCampaignLeads();
      loadAllLeads();
    } catch (e) {
      error = e.message || "Failed to send";
    } finally {
      nurtureSending = false;
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
      <button type="button" class="tab" class:active={viewMode === "analytics"} onclick={() => { playClick(); viewMode = "analytics"; loadAnalytics(); loadSimilarLeads(); }}>
        Analytics
      </button>
    </div>
    <div class="campaigns-toolbar-right">
      <button type="button" class="btn-icp" onclick={() => { playClick(); showIcpPanel = !showIcpPanel; if (showIcpPanel) loadIcp(); }} title="Ideal Customer Profile">
        Ideal Customer
      </button>
      <button type="button" class="btn-create" onclick={() => { playClick(); showCreateForm = !showCreateForm; }} disabled={viewMode !== "campaigns"}>
        New campaign
      </button>
    </div>
  </div>

  {#if showIcpPanel}
    <section class="icp-section">
      <h3 class="section-title">Ideal Customer Profile (ICP)</h3>
      <p class="icp-desc">Define who your best customer is. This helps prioritize leads and match them to your profile.</p>
      <div class="icp-form">
        <label for="icp-industry">Industry</label>
        <input id="icp-industry" type="text" bind:value={icp.industry} placeholder="e.g. SaaS, Retail, Healthcare" />
        <label for="icp-company-size">Company size</label>
        <input id="icp-company-size" type="text" bind:value={icp.companySize} placeholder="e.g. 10–50 employees, Enterprise" />
        <label for="icp-role">Target role / title</label>
        <input id="icp-role" type="text" bind:value={icp.role} placeholder="e.g. Marketing Manager, CTO" />
        <label for="icp-needs">Primary needs</label>
        <input id="icp-needs" type="text" bind:value={icp.needs} placeholder="e.g. Lead gen, CRM integration" />
        <label for="icp-pain-points">Pain points</label>
        <input id="icp-pain-points" type="text" bind:value={icp.painPoints} placeholder="e.g. Manual follow-up, lost leads" />
        <button type="button" class="btn-save" disabled={icpSaving} onclick={saveIcp}>{icpSaving ? "Saving…" : "Save ICP"}</button>
      </div>
    </section>
  {/if}

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
              <div class="leads-section-header">
                <h4 class="leads-subtitle">Conversations ({filteredCampaignLeads.length}{#if leadFilter !== "all"} of {campaignLeads.rooms.length}{/if})</h4>
                <div class="leads-sort-filter">
                  <select class="lead-filter-select" bind:value={leadFilter} onchange={() => playClick()}>
                    <option value="all">All leads</option>
                    <option value="hot">Hot only</option>
                    <option value="warm">Warm+</option>
                    <option value="icp">ICP match</option>
                  </select>
                  <select class="lead-sort-select" bind:value={leadSort} onchange={() => playClick()}>
                    <option value="hot">Sort: Hot first</option>
                    <option value="cool">Sort: Cool first</option>
                    <option value="newest">Sort: Newest</option>
                    <option value="icp">Sort: ICP fit</option>
                  </select>
                </div>
              </div>
              {#if filteredCampaignLeads.length === 0}
                <p class="leads-empty">{campaignLeads.rooms.length === 0 ? "No conversations yet. When you accept pending requests or add rooms to this campaign, they appear here." : `No leads match the filter (${leadFilter}). Try "All leads" or a different sort.`}</p>
              {:else}
                <ul class="leads-list">
                  {#each filteredCampaignLeads as room (room.id)}
                    <li class="lead-item">
                      <button type="button" class="lead-row" onclick={() => { playClick(); onJoinRoom(room); }}>
                        <div class="lead-main">
                          <span class="lead-name">{room.name}</span>
                          <span class="lead-preview">{room.lastMessagePreview || room.description || "No messages"}</span>
                        </div>
                        <div class="lead-meta">
                          {#if room.engagementScore != null}
                            <span class="lead-score lead-score-{getEngagementLabel(room.engagementScore).toLowerCase()}" title="Engagement: {room.engagementScore}">{getEngagementLabel(room.engagementScore)}</span>
                          {/if}
                          {#if room.icpFitScore != null && room.icpFitScore > 0}
                            <span class="lead-icp-fit" title="ICP fit: {room.icpFitScore}%">ICP {room.icpFitScore}%</span>
                          {/if}
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
                        <select
                          class="lead-qual-select"
                          value={room.qualificationStatus || ""}
                          onchange={(e) => setQualification(room.id, e.target.value || null)}
                          onclick={(e) => e.stopPropagation()}
                        >
                          {#each QUALIFICATION_OPTIONS as opt}
                            <option value={opt.value}>{opt.label}</option>
                          {/each}
                        </select>
                        <button type="button" class="btn-star" class:starred={room.isBestCustomer} title={room.isBestCustomer ? "Best customer" : "Mark as best customer"} onclick={(e) => { e.stopPropagation(); setBestCustomer(room.id, !room.isBestCustomer); }}>★</button>
                        <button type="button" class="btn-nurture" title="Send nurture message" onclick={(e) => { e.stopPropagation(); nurtureRoom = room; nurtureMessage = ""; }}>Nurture</button>
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
  {:else if viewMode === "analytics"}
    <div class="campaigns-main campaigns-main-full">
      <div class="analytics-header">
        <h3 class="leads-title">Source performance</h3>
        <button type="button" class="btn-refresh" onclick={() => loadAnalytics()} disabled={analyticsLoading}>Refresh</button>
      </div>
      {#if analyticsLoading}
        <p class="leads-loading">Loading…</p>
      {:else}
        <div class="analytics-section">
          <h4 class="analytics-subtitle">By source</h4>
          <p class="analytics-desc">See which channels bring the most leads and conversions.</p>
          {#if analytics.bySource.length === 0}
            <p class="leads-empty">No campaign data yet. Create campaigns and add rooms to see performance.</p>
          {:else}
            <div class="analytics-table-wrap">
              <table class="analytics-table" role="grid">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Campaigns</th>
                    <th>Leads</th>
                    <th>New</th>
                    <th>Hot</th>
                    <th>Payment</th>
                    <th>Customer</th>
                    <th>Conv. %</th>
                  </tr>
                </thead>
                <tbody>
                  {#each analytics.bySource as row (row.source)}
                    <tr>
                      <td><span class="source-badge source-{row.source}">{row.source}</span></td>
                      <td>{row.campaigns}</td>
                      <td>{row.total}</td>
                      <td>{row.new_lead}</td>
                      <td>{row.hot_lead}</td>
                      <td>{row.payment}</td>
                      <td>{row.customer}</td>
                      <td><strong>{row.conversionRate}%</strong></td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
        <div class="analytics-section">
          <div class="analytics-section-header">
            <h4 class="analytics-subtitle">Find similar leads</h4>
            <button type="button" class="btn-refresh btn-sm" onclick={() => loadSimilarLeads()} disabled={similarLoading}>{similarLoading ? "Loading…" : "Find similar"}</button>
          </div>
          <p class="analytics-desc">Leads similar to your best customers (same source, engagement). Mark leads as best customer (★) to improve recommendations.</p>
          {#if similarLeads.length === 0}
            <p class="leads-empty">Mark leads as best customer (★) to find similar leads, or click "Find similar" to refresh.</p>
          {:else}
            <ul class="similar-leads-list">
              {#each similarLeads as room (room.id)}
                <li class="similar-lead-item">
                  <button type="button" class="similar-lead-row" onclick={() => { playClick(); onJoinRoom(room); }}>
                    <span class="lead-name">{room.name}</span>
                    <span class="lead-score lead-score-{getEngagementLabel(room.engagementScore).toLowerCase()}">{getEngagementLabel(room.engagementScore)}</span>
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
        </div>

        <div class="analytics-section">
          <h4 class="analytics-subtitle">By campaign</h4>
          <p class="analytics-desc">Conversion funnel per campaign.</p>
          {#if analytics.byCampaign.length === 0}
            <p class="leads-empty">No campaigns yet.</p>
          {:else}
            <div class="analytics-table-wrap">
              <table class="analytics-table" role="grid">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Source</th>
                    <th>Leads</th>
                    <th>New</th>
                    <th>Hot</th>
                    <th>Payment</th>
                    <th>Customer</th>
                    <th>Conv. %</th>
                  </tr>
                </thead>
                <tbody>
                  {#each analytics.byCampaign as row (row.id)}
                    <tr>
                      <td>{row.name}</td>
                      <td><span class="source-badge source-{row.source}">{row.source}</span></td>
                      <td>{row.total}</td>
                      <td>{row.new_lead}</td>
                      <td>{row.hot_lead}</td>
                      <td>{row.payment}</td>
                      <td>{row.customer}</td>
                      <td><strong>{row.conversionRate}%</strong></td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      {/if}
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
          <div class="leads-section-header">
            <h4 class="leads-subtitle">Leads ({filteredAllLeads.length}{#if leadFilter !== "all"} of {allLeads.rooms.length}{/if})</h4>
            <div class="leads-sort-filter">
              <select class="lead-filter-select" bind:value={leadFilter} onchange={() => playClick()}>
                <option value="all">All leads</option>
                <option value="hot">Hot only</option>
                <option value="warm">Warm+</option>
                <option value="icp">ICP match</option>
              </select>
              <select class="lead-sort-select" bind:value={leadSort} onchange={() => playClick()}>
                <option value="hot">Sort: Hot first</option>
                <option value="cool">Sort: Cool first</option>
                <option value="newest">Sort: Newest</option>
                <option value="icp">Sort: ICP fit</option>
              </select>
            </div>
          </div>
          {#if filteredAllLeads.length === 0}
            <p class="leads-empty">{allLeads.rooms.length === 0 ? "No leads yet. Create a campaign and add rooms, or share invite links." : `No leads match the filter (${leadFilter}). Try "All leads" or a different sort.`}</p>
          {:else}
            <ul class="leads-list">
              {#each filteredAllLeads as room (room.id)}
                <li class="lead-item">
                  <button type="button" class="lead-row" onclick={() => { playClick(); onJoinRoom(room); }}>
                    <div class="lead-main">
                      <span class="lead-name">{room.name}</span>
                      <span class="lead-preview">{room.lastMessagePreview || "No messages"}</span>
                    </div>
                    <div class="lead-meta">
                      {#if room.engagementScore != null}
                        <span class="lead-score lead-score-{getEngagementLabel(room.engagementScore).toLowerCase()}" title="Engagement: {room.engagementScore}">{getEngagementLabel(room.engagementScore)}</span>
                      {/if}
                      {#if room.icpFitScore != null && room.icpFitScore > 0}
                        <span class="lead-icp-fit" title="ICP fit: {room.icpFitScore}%">ICP {room.icpFitScore}%</span>
                      {/if}
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
                    <select
                      class="lead-qual-select"
                      value={room.qualificationStatus || ""}
                      onchange={(e) => setQualification(room.id, e.target.value || null)}
                      onclick={(e) => e.stopPropagation()}
                    >
                      {#each QUALIFICATION_OPTIONS as opt}
                        <option value={opt.value}>{opt.label}</option>
                      {/each}
                    </select>
                    <button type="button" class="btn-star" class:starred={room.isBestCustomer} title={room.isBestCustomer ? "Best customer" : "Mark as best customer"} onclick={(e) => { e.stopPropagation(); setBestCustomer(room.id, !room.isBestCustomer); }}>★</button>
                    <button type="button" class="btn-nurture" title="Send nurture message" onclick={(e) => { e.stopPropagation(); nurtureRoom = room; nurtureMessage = ""; }}>Nurture</button>
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

{#if nurtureRoom}
  <div class="nurture-modal-overlay" role="dialog" tabindex="-1" onkeydown={(e) => e.key === "Escape" && (nurtureRoom = null)} onclick={(e) => e.target === e.currentTarget && (nurtureRoom = null)}>
    <div class="nurture-modal">
      <h3>Send nurture message to {nurtureRoom.name}</h3>
      <p class="nurture-hint">This message will appear in the conversation as a message from you.</p>
      <textarea bind:value={nurtureMessage} placeholder="Type your message..." rows="4"></textarea>
      <div class="nurture-actions">
        <button type="button" class="btn-cancel" onclick={() => nurtureRoom = null}>Cancel</button>
        <button type="button" class="btn-save" disabled={nurtureSending || !nurtureMessage.trim()} onclick={sendNurtureMessage}>{nurtureSending ? "Sending…" : "Send"}</button>
      </div>
    </div>
  </div>
{/if}

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
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #ffffff;
    color: #374151;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .btn-back:hover {
    background: #f9fafb;
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

  .campaigns-toolbar-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .btn-icp {
    padding: 0.5rem 1rem;
    border: 1px solid #10b981;
    border-radius: 8px;
    background: #10b981;
    color: #ffffff;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .btn-icp:hover {
    background: #059669;
  }

  .icp-section {
    margin-bottom: 1.5rem;
    padding: 1.25rem;
    background: var(--blue-50, #eff6ff);
    border: 1px solid var(--blue-200, #bfdbfe);
    border-radius: 12px;
  }

  .icp-desc {
    margin: 0 0 1rem;
    font-size: 0.875rem;
    color: var(--gray-600);
  }

  .icp-form label {
    display: block;
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .icp-form input {
    width: 100%;
    max-width: 400px;
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 0.9375rem;
  }

  .icp-form .btn-save {
    margin-top: 0.5rem;
  }

  .lead-score {
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .lead-score-hot { background: #fef2f2; color: #dc2626; }
  .lead-score-warm { background: #fff7ed; color: #ea580c; }
  .lead-score-cool { background: #eff6ff; color: #2563eb; }
  .lead-score-cold { background: var(--gray-100); color: var(--gray-600); }

  .lead-icp-fit {
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    background: #ecfdf5;
    color: #059669;
  }

  .leads-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
  }

  .leads-section-header .leads-subtitle {
    margin: 0;
  }

  .leads-sort-filter {
    display: flex;
    gap: 0.5rem;
  }

  .lead-filter-select,
  .lead-sort-select {
    padding: 0.35rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.8125rem;
  }

  .analytics-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.25rem;
  }

  .analytics-section {
    margin-bottom: 1.5rem;
  }

  .analytics-subtitle {
    margin: 0 0 0.5rem;
    font-size: 1rem;
    font-weight: 600;
  }

  .analytics-desc {
    margin: 0 0 0.75rem;
    font-size: 0.875rem;
    color: var(--gray-600);
  }

  .analytics-table-wrap {
    overflow-x: auto;
  }

  .analytics-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .analytics-table th,
  .analytics-table td {
    padding: 0.6rem 0.75rem;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }

  .analytics-table th {
    font-weight: 600;
    color: var(--gray-600);
    white-space: nowrap;
  }

  .analytics-table tbody tr:hover {
    background: var(--gray-50);
  }

  .source-badge {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: capitalize;
  }

  .source-badge.source-manual { background: var(--gray-100); color: var(--gray-700); }
  .source-badge.source-widget { background: #eff6ff; color: #2563eb; }
  .source-badge.source-invite { background: #ecfdf5; color: #059669; }
  .source-badge.source-form { background: #fef3c7; color: #d97706; }

  .lead-qual-select {
    padding: 0.25rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 0.8125rem;
  }

  .btn-star {
    padding: 0.25rem 0.5rem;
    border: none;
    background: none;
    font-size: 1.125rem;
    color: var(--gray-400);
    cursor: pointer;
  }

  .btn-star:hover,
  .btn-star.starred { color: #f59e0b; }

  .btn-nurture {
    padding: 0.25rem 0.5rem;
    border: 1px solid #10b981;
    border-radius: 6px;
    background: #10b981;
    color: #ffffff;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
  }

  .btn-nurture:hover { background: #059669; }

  .nurture-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .nurture-modal {
    background: var(--card-bg);
    padding: 1.5rem;
    border-radius: 12px;
    min-width: 360px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
  }

  .nurture-modal h3 { margin: 0 0 0.5rem; font-size: 1.125rem; }
  .nurture-hint { margin: 0 0 1rem; font-size: 0.8125rem; color: var(--gray-600); }
  .nurture-modal textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 0.9375rem;
    margin-bottom: 1rem;
    resize: vertical;
  }

  .nurture-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }

  .analytics-section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .btn-sm { padding: 0.35rem 0.75rem; font-size: 0.8125rem; }

  .similar-leads-list { list-style: none; margin: 0; padding: 0; }
  .similar-lead-item { margin-bottom: 0.25rem; }
  .similar-lead-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card-bg);
    text-align: left;
    cursor: pointer;
    font-family: inherit;
  }

  .similar-lead-row:hover { background: var(--gray-50); }

  .btn-create {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 8px;
    background: #10b981;
    color: #ffffff;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
  }

  .btn-create:hover:not(:disabled) {
    background: #059669;
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
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    background: #ffffff;
    color: #374151;
    font-size: 0.875rem;
    cursor: pointer;
    font-family: inherit;
  }

  .btn-save {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 8px;
    background: #10b981;
    color: #ffffff;
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
    border: 1px solid #10b981;
    border-radius: 6px;
    background: #10b981;
    color: #ffffff;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .btn-refresh:hover {
    background: #059669;
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
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    background: #ffffff;
    color: #374151;
    font-size: 0.8125rem;
    cursor: pointer;
    font-family: inherit;
  }

  .btn-decline:hover {
    background: #f9fafb;
  }

  .btn-accept {
    padding: 0.375rem 0.75rem;
    border: none;
    border-radius: 6px;
    background: #10b981;
    color: #ffffff;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    font-family: inherit;
  }

  .btn-accept:hover {
    background: #059669;
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
