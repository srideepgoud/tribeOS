# TribeOS Event Workspace — UX Specification

Status: Proposed (design only, no implementation)
Companion to: TribeOS UX Refactoring RFC (`.cursor/plans/event_workspace_ux_rfc_*.plan.md`)
Scope: Frontend behavior only (`apps/web`, `packages/ui`). No backend, database, financial-rule, or terminology changes.

This document is screen-by-screen. The RFC explains what to build and why; this spec explains exactly how each screen behaves. Every screen section follows the same template:

- Purpose
- Information shown
- Actions available
- Navigation (in/out)
- Empty state
- Loading state
- Error state
- Desktop / mobile behavior

---

## 0. Global conventions

These apply to every screen unless overridden.

- Primary object: the Budget Line (backend `Cost Item`). Most creation flows start from a line and inherit event + cost item context.
- Terminology (UI labels only; backend entities unchanged): Cost Category = "Budget Section", Cost Item = "Budget Line", Transaction = "Expense" (in the Expenses tab). Vendor Work Order stays "Work Order". Never show "Purchase Order".
- Design system: dark-first, shadcn/ui primitives from `@tribeos/ui`, Lucide icons, semantic tokens only (`bg-surface`, `text-muted`, `text-danger`, etc.), Inter font. Numbers right-aligned, tabular figures, consistent currency.
- Money honesty: never render manual "Mark Paid"; invoice Partially Paid/Paid are derived. Never imply zero spend when Unattributed Spend > 0. Always label derived values as derived.
- State gating: the UI mirrors the Event/Cost Item/Work Order/Invoice state machines to show/hide affordances, but the backend is the source of truth. Rejected transitions surface the backend's structured 409 as an inline error/toast; the UI never silently changes state.
- Standard states: every list/table/panel implements empty, loading (skeleton preferred; spinner only if >500ms), and error (with retry) states. Never a blank table.
- Toasts: top-right; success/warning/error/info. Autosave shows a subtle "Saved" confirmation, not a blocking toast.
- Optimistic updates: inline edits update immediately via React Query, then reconcile; on failure, roll back the cell and show an error toast.

### Workspace shell (persistent chrome around every tab)

- Route: `/events/[eventId]`, nested layout hosting a context header + tab bar + tab content.
- Context header (always visible): Event name, Client, date range, status badge, and a compact KPI strip — Budget, Committed, Cash Spent, Unattributed, Outstanding, Profit (all derived, read-only).
- Breadcrumb: Events / {Event name} / {Tab}.
- Tab bar: Overview | Budget | Execution | Expenses | Invoices | Settlement | Timeline (Documents later). Tabs disabled per lifecycle are visible but greyed with a tooltip ("Available from Commercials").
- Loading: header shows skeleton KPI chips; tab content shows its own skeleton.
- Error (event fetch fails): full-tab error state with retry; header collapses to breadcrumb + retry.
- Desktop: sidebar (280px) + shell; tab bar horizontal. Mobile: sidebar becomes a drawer; context header condenses to name + status + a "…" for KPIs; tab bar becomes a horizontally scrollable segmented control or a select.

---

## 1. Overview tab — "Can I run this event?"

Purpose: Answer, at a glance, whether the event is ready to progress, and give one clear next action. Not a metrics dump.

Information shown:
- Readiness board — one card per indicator, each with status (done / attention / blocked) and a one-line detail:
  - Budget Complete, Commercial Complete, Vendor Coverage (e.g. "8 of 12 lines have a work order"), Pending Payments, Pending Collections (Event Outstanding), Settlement Readiness (the three close gates), Profit Forecast (Billed Revenue − Attributed Cost, labeled forecast/derived).
- Next Action banner — a single prioritized CTA computed from lifecycle + readiness (e.g. "Assign vendors to 4 uncovered lines").
- Recent activity — last few Timeline entries (link to Timeline tab).

Actions available:
- Click Next Action → deep-links to the exact tab/line to resolve it.
- Click any readiness card → deep-links to the relevant tab (e.g. Pending Collections → Invoices).
- Advance lifecycle (status transition control) when the current phase's exit criteria are met; disabled with tooltip otherwise. Rejections surface backend 409.

Navigation: Entered from Events list, dashboard deep links, or default tab on workspace open. Exits to any other tab via cards/CTA.

Empty state: New event with no budget → readiness cards show "Not started" with a primary "Build budget" CTA linking to the Budget tab.

Loading: Skeleton cards in the readiness grid.

Error: Per-card error only for the failing metric (others still render); board-level retry if the aggregate readiness call fails.

Desktop / mobile: Desktop = responsive card grid (2–4 columns). Mobile = single-column stack, Next Action pinned at top.

---

## 2. Budget tab — the spreadsheet

Purpose: Build and manage the entire event budget in one nested, Excel-like screen without dialogs or re-selecting context.

Information shown:
- Budget tree: collapsible Budget Sections, each containing Budget Lines.
- Per line columns: Name, Planned, Committed (derived from work orders), Actual/Spent (Attributed Cost from allocations), Variance/Remaining, status.
- Section subtotal row; event total in a sticky footer and in the context header.

Actions available:
- Inline edit line name and planned amount (autosave on blur/Enter, optimistic).
- Add Line: inline draft row inside a section (event + section pre-filled); type name + planned, Enter to commit.
- Add Section: inline row at tree root.
- Reorder lines/sections via drag handle or keyboard.
- Collapse/expand sections.
- Select a line → opens Budget Line Detail Panel (Section 3).
- Row overflow menu: full edit (fallback dialog), archive (with confirm), change status where allowed.
- Bulk paste (later): paste rows from clipboard to create multiple lines.
- Editing respects state: Planned = editable; Approved+ = locked (fields render read-only with a lock tooltip).

Navigation: Tab in workspace. Selecting a line opens the side-panel without leaving the tab. Global Cost Categories/Cost Items pages remain under Setup as a fallback/library.

Empty state: No sections yet → centered empty state with "Add your first section" and a hint about bulk paste / templates.

Loading: Skeleton tree (section headers + a few line rows).

Error: Tree-level error with retry; a failed inline edit rolls back the single cell and toasts.

Desktop / mobile: Desktop = full table with all columns; detail opens as a right side-sheet. Mobile = condensed rows (Name + Planned + a chevron); secondary columns behind expand; detail opens full-screen.

---

## 3. Budget Line Detail Panel — the control center

Purpose: Turn a single Budget Line into a mini-workspace that bridges planning and execution. Every operational artifact for the line is here, with context-aware creation.

Information shown:
- Header: line name, status, Budget / Committed / Spent / Remaining.
- Vendor Work Orders on this line (vendor, status, amount).
- Expenses on this line (description, method, amount, allocation status).
- Attribution/allocation health for the line.
- Documents/notes (later).

Actions available:
- Edit line (name, planned) inline in the header (respecting state).
- "+ Assign vendor" → Work Order side-form pre-filled with event + this cost item; user supplies vendor + terms.
- "+ Record expense" → Expense/allocation side-form pre-filled with event + this line; user supplies amount + method.
- Open any work order/expense → its own detail/edit surface (reuses existing components).
- Advance work order / transaction status where allowed (surfaces 409 on invalid).
- All actions disabled/read-only when the line's Cost Item or the Event is in a non-editable state (e.g. Closed).

Navigation: Opens from the Budget tree (and from Overline links). "Open in Execution/Expenses" links jump to the filtered tab. Closing returns focus to the originating budget row.

Empty state: New line → shows budget figures with two prominent CTAs ("Assign vendor", "Record expense") and empty sub-lists.

Loading: Skeleton for header figures and each sub-list.

Error: Per-section error (work orders vs expenses load independently) with retry; header figures degrade gracefully.

Desktop / mobile: Desktop = right side-sheet (≤ ~480px) over the Budget tree. Mobile = full-screen sheet with a back affordance.

---

## 4. Execution tab — Vendor Work Orders (commitment side)

Purpose: Manage vendor commitments for the event; make budget coverage (which lines have work orders) obvious.

Information shown:
- Work Orders for this event, grouped by Budget Line, showing coverage per line (committed vs planned).
- Per work order: number, vendor, cost item/line, amount, status.
- Event-level committed total.

Actions available:
- "Assign vendor" (from a line group) → pre-filled work order form (event + cost item known).
- Open work order → edit + status transitions (`status-transition-control`), unchanged rules; 409 surfaced.
- Filter/search by vendor, status, line.
- (Future, name already scales) Purchase Requests, Deliveries, Vendor Payments.

Navigation: Tab in workspace; deep-linked from Overview (Vendor Coverage) and from Budget Line Detail. Global Work Orders list remains for cross-event Procurement triage.

Empty state: No work orders → "No vendors assigned yet" with "Assign vendor" CTA and a hint that lines without coverage are highlighted.

Loading: Skeleton grouped list.

Error: List-level error with retry.

Desktop / mobile: Desktop = grouped table. Mobile = grouped cards; status as badge; primary action per group.

---

## 5. Expenses tab — Transactions (cash-out side)

Purpose: Record and reconcile event cash outflow in the user's language, with clear allocation status.

Information shown:
- Event ledger (expense-type transactions): date, description, kind (Vendor Payment / Misc Expense / Reimbursement), method (Cash / Card / UPI — display facet over existing fields), amount, allocation status (Unattributed / Partial / Full).
- Event financial summary cards (reuses existing computed summary: cash spent, unattributed, etc.).

Actions available:
- "Record expense" → transaction form pre-scoped to event; allocation editor inline (side-sheet).
- "Allocate" on a row → allocation side-sheet (reuses `allocation-editor`).
- Filter by kind, method, allocation status; search.
- Reverse a completed transaction via the correction flow (append-only; never edit cash fields). 409/immutability rules preserved.

Navigation: Tab in workspace; deep-linked from Overview (Pending Payments / Unattributed) and Budget Line Detail. Global Transactions list remains for org-wide finance.

Empty state: "No expenses recorded" with "Record expense" CTA.

Loading: Skeleton summary cards + skeleton rows.

Error: Summary and list load independently, each with retry.

Desktop / mobile: Desktop = summary strip + table. Mobile = summary as a horizontally scrollable chip row + expense cards; allocation side-sheet becomes full-screen.

---

## 6. Invoices tab — Client Invoices (revenue side)

Purpose: Manage what the client owes for this event; keep billing separate from cash.

Information shown:
- Client Invoices for this event: number, issue date, amount, derived status (Draft / Issued / Partially Paid / Paid / Cancelled), outstanding.
- Event Outstanding total.

Actions available:
- "New invoice" → pre-filled with event + client.
- Open invoice → detail (issue, cancel where allowed, view linked receipts). Edit only in Draft.
- Never a manual "Mark Paid" — status is derived from receipts.
- Cancel Issued only when outstanding equals invoice total (mirror backend rule; 409 otherwise).

Navigation: Tab in workspace; deep-linked from Overview (Pending Collections). Global Client Invoices list remains for org-wide AR.

Empty state: "No invoices yet" with "New invoice" CTA.

Loading: Skeleton rows.

Error: List-level error with retry; detail dialog has its own error/retry.

Desktop / mobile: Desktop = table + detail dialog. Mobile = invoice cards; detail as full-screen sheet.

---

## 7. Settlement tab — readiness & close

Purpose: Reconcile the event and gate the transition to Closed (Financial Close).

Information shown:
- The three close gates (mirrors `FinancialReadinessPanel`): Outstanding cleared, all spend allocated (no Unattributed Spend), no pending financial transactions — each pass/fail with a link to fix.
- Event P&L: Billed Revenue, Attributed Cost, Profit, Margin (all derived).
- Budget-freeze indicator.

Actions available:
- "Close event" (Settlement → Closed) — enabled only when all gates pass; disabled with explanation otherwise. Surfaces backend 409 if rejected.
- Each failing gate links to the tab/line needed to resolve it.
- Allocations remain editable during Settlement (link into Expenses/line detail).

Navigation: Tab in workspace; foregrounded when Event is in Settlement. Deep-linked from Overview (Settlement Readiness).

Empty state: If event not yet in Settlement → informational state explaining Settlement unlocks after Execution.

Loading: Skeleton gates + P&L.

Error: Panel-level error with retry.

Desktop / mobile: Desktop = gates checklist beside P&L. Mobile = stacked; Close action pinned.

---

## 8. Timeline tab — Audit Log narrative

Purpose: Show the immutable history of the event as a readable chronology.

Information shown:
- Reverse-chronological entries from the Audit Log: created, budget changed, vendor assigned, work order issued, invoice raised, payment received, closed, etc. Each entry: timestamp, actor, action, affected entity (linked).

Actions available:
- Read-only. Click an entry's entity → deep-link to that record/line.
- Filter by entity type or date (optional).

Navigation: Tab in workspace; "Recent activity" on Overview links here.

Empty state: "No activity yet" (only realistic for brand-new drafts).

Loading: Skeleton timeline items.

Error: List-level error with retry.

Desktop / mobile: Desktop = vertical timeline with entity chips. Mobile = same, condensed; infinite scroll / load more.

---

## 9. Cross-cutting behaviors

- Deep linking: every readiness card, Next Action, and gate resolves to a specific tab (and, where possible, a specific line via the Detail Panel).
- Keyboard: Budget tree supports Enter (commit), Esc (cancel), Tab/Arrow navigation between editable cells; Detail Panel closable with Esc.
- Permissions/roles: role checks are enforced by the backend; the UI hides actions the current role cannot perform and never fabricates capability.
- Responsiveness baseline: the workspace must be usable below `lg` (current sidebar is `hidden lg:flex` with no fallback — a mobile nav drawer is a prerequisite for shipping the workspace on mobile).
- Consistency: all tabs reuse existing `features/*` components and `services/*` (the only API layer). No `fetch()` in components; no business logic in components.

---

## 10. Screen inventory (quick reference)

- Overview — readiness board + Next Action
- Budget — nested Sections/Lines spreadsheet
- Budget Line Detail Panel — line control center (side-sheet)
- Execution — Vendor Work Orders grouped by line
- Expenses — event transaction ledger with kind/method facets
- Invoices — event client invoices, derived status
- Settlement — close gates + Event P&L
- Timeline — Audit Log chronology
- (Global, unchanged) Dashboard, Events, Clients, Vendors, Work Orders, Client Invoices, Transactions
- (Setup, demoted) Cost Categories, Cost Items
