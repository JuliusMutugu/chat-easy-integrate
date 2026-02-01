# Product Roadmap: Deal-Ready Messaging Platform

**Vision:** A hyper-reactive, structured messaging platform for negotiations—Kenya to World—with closing infrastructure and trust built in.

**Reference:** [respond.io](https://respond.io) is the agreed picture of what we’re building toward: omnichannel inbox, team/conversation management, contact management, workflows. See [VISION_RESPONDIO.md](./VISION_RESPONDIO.md) for how respond.io aligns with Nego and where our deal-ready edge fits in.

---

## 1. Svelte 5 Reactive Core

| Goal | Status | Implementation |
|------|--------|----------------|
| **Negotiation runes ($state, $derived)** | Done | `DealPanel.svelte`: price, qty, sla in `$state`; tax, shipping, margin in `$derived`. Changes recalc instantly. |
| **Snippets for widgets** | Done | Message type `deal_terms`: payload (price, qty, slaDays) rendered as a widget in chat. “Share current terms” sends deal_terms. |
| **Optimistic UI** | Done | Send adds message with `clientId` and status `pending`; server echoes `clientId` in `new-message`; we replace pending. |

---

## 2. Structured Messaging (Beyond Text)

| Goal | Status | Implementation |
|------|--------|----------------|
| **Deal block** | Done | `DealPanel` above messages: Current Terms (Price, Qty, SLA). Edits emit `update-deal-term`; server stores in `deal_events`. |
| **Version history / audit trail** | Done | `deal_events` table + GET `/api/rooms/:roomId/deal-events`. “Version history” in DealPanel shows timeline (EAT). |
| **Redlining lite** | Done | "Suggest edit" on text messages; message type `redline` with original/suggested; rendered as inline diff in chat. |

---

## 3. Omnichannel “Kenya to World” Bridge

| Goal | Status | Implementation |
|------|--------|----------------|
| **WhatsApp / SMS gateway** | Done | Integrations: our own engine (no Twilio). SMS gateway URL, WhatsApp API URL, Email SMTP. Messages converge in platform. |
| **Identity verification** | Planned | **Local:** IPRS (Kenya) for local trust. **Global:** Onfido / Stripe Identity. Ensure we’re not negotiating with bots or scammers. |

---

## 4. Frictionless Closing Infrastructure

| Goal | Status | Implementation |
|------|--------|----------------|
| **Dual-currency / dual-gateway** | Planned | **Local:** M-Pesa (Daraja API), Pesapal. **Global:** Stripe, PayPal. Configurable per room or org. |
| **Smart invoicing** | Planned | KRA-compliant (Kenya) or VAT-compliant invoice generated when “Accept” is clicked in chat. |
| **E-signatures** | Planned | Built-in, legally binding signature tool (HelloSign-style) that works inside the mobile browser. |

---

## 5. Security & Compliance (Trust Layer)

| Goal | Status | Implementation |
|------|--------|----------------|
| **KDPP & GDPR ready** | Done | Settings: Privacy & compliance (Request data export, Request deletion, Data residency option). API stubs POST `/api/me/export`, `/api/me/delete`. |
| **Role-based access (RBAC)** | Done | `room_member_roles` table; GET/POST `/api/rooms/:roomId/roles`. Assign member/manager; approval workflow placeholder. |

---

## Implementation Notes

- **Runes:** Use `$state` for live offer (price, qty, SLA, options); `$derived` for tax, shipping, margin so any slider change recalculates instantly.
- **Optimistic UI:** On send, push message to local list with `status: 'pending'` and optional `clientId`; on server `new-message` or error, reconcile (replace or mark failed).
- **Deal block:** Read from shared “current terms” (from negotiation or last accepted deal_terms message); allow edits that emit deal_events.
- **Audit trail:** All term changes and key actions write to `deal_events`; timeline component subscribes to room’s events (or fetches from API).
- **Snippet widget:** Message `type: 'deal_terms'`, `payload: { price, qty, sla, options }`; in chat, render with `{#snippet child({ payload })}{@render child?.()} {/snippet}` or a dedicated DealTermsWidget component.
