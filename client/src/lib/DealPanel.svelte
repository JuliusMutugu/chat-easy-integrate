<script>
  import { onMount, onDestroy } from "svelte";
  /**
   * Deal Block – Live offer with Svelte 5 runes.
   * $state: price, qty, sla (user-editable).
   * $derived: tax, shipping, margin (instant recalc, no reload).
   */
  let { roomId = "", username = "", socket = null, config = { serverUrl: "" }, onSendTerms = () => {}, initialTerms = null } = $props();

  let dealEvents = $state([]);

  let price = $state(100);
  let qty = $state(1);
  let slaDays = $state(7);
  let taxRatePct = $state(16);
  let shippingFlat = $state(10);
  let marginPct = $state(20);

  function applyInitialTerms(terms) {
    if (!terms || typeof terms.price !== "number") return;
    price = terms.price;
    if (typeof terms.qty === "number" && terms.qty >= 1) qty = terms.qty;
    if (typeof terms.slaDays === "number" && terms.slaDays >= 1) slaDays = terms.slaDays;
    if (typeof terms.taxRatePct === "number") taxRatePct = terms.taxRatePct;
    if (typeof terms.shippingFlat === "number") shippingFlat = terms.shippingFlat;
    if (typeof terms.marginPct === "number") marginPct = terms.marginPct;
  }

  onMount(() => {
    loadEvents();
    if (socket) {
      socket.on("deal-term-updated", onTermUpdated);
      socket.on("deal-event", onDealEvent);
    }
    applyInitialTerms(initialTerms);
  });

  onDestroy(() => {
    if (socket) {
      socket.off("deal-term-updated", onTermUpdated);
      socket.off("deal-event", onDealEvent);
    }
  });

  async function loadEvents() {
    if (!roomId || !config.serverUrl) return;
    try {
      const res = await fetch(`${config.serverUrl}/api/rooms/${roomId}/deal-events`, {
        credentials: "include",
      });
      if (res.ok) dealEvents = await res.json();
    } catch (_) {}
  }

  function onTermUpdated({ field, newValue }) {
    const v = Number(newValue);
    if (field === "price" && !isNaN(v)) price = v;
    if (field === "qty" && !isNaN(v)) qty = Math.max(1, Math.floor(v));
    if (field === "sla_days" && !isNaN(v)) slaDays = Math.max(1, Math.floor(v));
  }

  function onDealEvent(event) {
    dealEvents = [...dealEvents, event];
  }

  const subtotal = $derived(price * qty);
  const tax = $derived((subtotal * taxRatePct) / 100);
  const shipping = $derived(shippingFlat * qty);
  const total = $derived(subtotal + tax + shipping);
  const costEstimate = $derived(total / (1 + marginPct / 100));
  const margin = $derived(total - costEstimate);

  function emitTerm(field, oldVal, newVal) {
    if (!socket || !roomId) return;
    socket.emit("update-deal-term", { roomId, field, oldValue: oldVal, newValue: newVal });
  }

  function onPriceChange(e) {
    const v = Number(e.target.value);
    if (isNaN(v)) return;
    const old = price;
    price = v;
    emitTerm("price", old, v);
  }

  function onQtyChange(e) {
    const v = Math.max(1, Math.floor(Number(e.target.value)));
    const old = qty;
    qty = v;
    emitTerm("qty", old, v);
  }

  function onSlaChange(e) {
    const v = Math.max(1, Math.floor(Number(e.target.value)));
    const old = slaDays;
    slaDays = v;
    emitTerm("sla_days", old, v);
  }

  function formatMoney(n) {
    return new Intl.NumberFormat("en-KE", { style: "decimal", minimumFractionDigits: 2 }).format(n);
  }

  function formatEventTime(d) {
    return new Date(d).toLocaleString("en-KE", { timeZone: "Africa/Nairobi", hour: "2-digit", minute: "2-digit" }) + " EAT";
  }
</script>

<div class="deal-panel">
  <h3 class="deal-title">Current terms</h3>

  <div class="deal-terms">
    <label class="deal-row">
      <span class="deal-label">Price (per unit)</span>
      <input type="number" min="0" step="0.01" value={price} onchange={onPriceChange} class="deal-input" />
    </label>
    <label class="deal-row">
      <span class="deal-label">Qty</span>
      <input type="number" min="1" step="1" value={qty} onchange={onQtyChange} class="deal-input" />
    </label>
    <label class="deal-row">
      <span class="deal-label">SLA (days)</span>
      <input type="number" min="1" step="1" value={slaDays} onchange={onSlaChange} class="deal-input" />
    </label>
  </div>

  <div class="deal-derived">
    <p class="deal-row"><span class="deal-label">Subtotal</span><span class="deal-value">{formatMoney(subtotal)}</span></p>
    <p class="deal-row"><span class="deal-label">Tax ({taxRatePct}%)</span><span class="deal-value">{formatMoney(tax)}</span></p>
    <p class="deal-row"><span class="deal-label">Shipping</span><span class="deal-value">{formatMoney(shipping)}</span></p>
    <p class="deal-row total"><span class="deal-label">Total</span><span class="deal-value">{formatMoney(total)}</span></p>
    <p class="deal-row"><span class="deal-label">Margin ({marginPct}%)</span><span class="deal-value">{formatMoney(margin)}</span></p>
  </div>

  <button type="button" class="deal-share" onclick={() => onSendTerms({
    price, qty, slaDays,
    taxRatePct, shippingFlat, marginPct,
    subtotal, tax, shipping, total, margin,
    versionCount: dealEvents.length,
    versionEvents: dealEvents.slice(-10).map(e => ({ username: e.username, field: e.field, oldValue: e.oldValue, newValue: e.newValue, createdAt: e.createdAt }))
  })}>Share current terms</button>

  <details class="deal-audit">
    <summary>Version history</summary>
    <ul class="deal-events">
      {#each dealEvents as event}
        <li class="deal-event">
          <strong>{event.username}</strong> changed {event.field} from {event.oldValue ?? "—"} to {event.newValue} · {formatEventTime(event.createdAt)}
        </li>
      {:else}
        <li class="deal-event empty">No changes yet.</li>
      {/each}
    </ul>
  </details>
</div>

<style>
  .deal-panel {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .deal-title {
    margin: 0 0 0.75rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--navy-900);
  }

  .deal-terms,
  .deal-derived {
    margin-bottom: 0.75rem;
  }

  .deal-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 0.35rem 0;
    font-size: 0.875rem;
  }

  .deal-row.total {
    font-weight: 700;
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--border);
  }

  .deal-label {
    color: var(--gray-600);
  }

  .deal-value {
    font-weight: 500;
    color: var(--navy-800);
  }

  .deal-input {
    width: 100px;
    padding: 0.35rem 0.5rem;
    border: 2px solid var(--border);
    border-radius: 6px;
    font-size: 0.875rem;
    font-family: inherit;
  }

  .deal-input:focus {
    outline: none;
    border-color: var(--green-600);
  }

  .deal-audit {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border);
    font-size: 0.8125rem;
  }

  .deal-audit summary {
    cursor: pointer;
    color: var(--navy-700);
    font-weight: 500;
  }

  .deal-events {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0 0;
  }

  .deal-event {
    padding: 0.35rem 0;
    color: var(--gray-700);
    border-bottom: 1px solid var(--border);
  }

  .deal-event:last-child {
    border-bottom: none;
  }

  .deal-event.empty {
    color: var(--gray-500);
  }

  .deal-share {
    margin-top: 0.75rem;
    padding: 0.5rem 1rem;
    background: var(--green-600);
    color: var(--white);
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .deal-share:hover {
    background: var(--green-700);
  }
</style>
