# Respond.io Clone: Dashboard System Rules

## 1. Scope & Folder Protection
- **Workzone:** `client/src/lib/` (MessagingModule, ChatRoom, Inbox, Settings, Integrations).
- **Protected:** NEVER touch root landing in `App.svelte`, hero, pricing, or marketing. Build only the internal app state.

## 2. Primary Navigation Rail (Leftmost - 64px)
Slim, dark-themed vertical bar. Icons in order:
1. **Dashboard** – LayoutDashboard (grid)
2. **Messages (Active)** – MessageSquareDot (with notification badge)
3. **Contacts** – Users
4. **Campaigns** – Megaphone
5. **Workflows** – GitBranch
6. **Analytics** – BarChart3
7. **Settings** – Settings  
**Bottom:** UserAvatar (green status indicator) + CompanyLogo.

## 3. Secondary Sidebar (300px - "The Organizer")
High-density collapsible sections:

### A. Inbox Headers
- Filters: All, Mine, Unassigned, Incoming Calls (with counts).
- Top bar: "All/Newest" toggle + "Unreplied" switch.

### B. AI Agents (CRITICAL)
- Label: "AI AGENTS" (uppercase, muted).
- Item: "AI Sales Agent" (AI icon + count badge e.g. 50).

### C. Lifecycle & Teams
- Lifecycle: icons (e.g. 🔥 Hot, 🚀 Fast).
- Teams: Sales APAC/EMEA, Marketing APAC/EMEA (with counts).

### D. Custom Inboxes
- Campaigns, VIP Clients.

## 4. UI/UX Component Specifications
- **ConversationCard:** Channel icon (bottom-right of avatar), Blue/Gray Status Label (e.g. "New Lead"), Inbound/Outbound arrow next to snippet.
- **System Events:** Centered, `text-xs font-medium text-slate-500 uppercase tracking-wider my-4` (small, muted, uppercase).

## 5. Technical Requirements
- **Layout:** `flex h-screen overflow-hidden`. Sidebar and Main Feed use independent scroll (`overflow-y: auto`).
- **State:** `selectedInbox` / `inboxCategory` to filter ConversationList.
- **Stack (this project):** CSS variables (no Tailwind), inline SVG icons.
