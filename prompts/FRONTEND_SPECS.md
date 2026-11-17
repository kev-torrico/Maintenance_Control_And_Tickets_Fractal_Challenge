# FRONTEND_SPECS.md — Maintenance Control & Tickets Frontend (React + Vite + Tailwind CSS)

## 1. Objective & Context

Build the production-ready React frontend inside the `frontend/` directory of this monorepo, connecting it to the existing Flask REST API (`backend/`, running on `http://localhost:5000/api/v1`) and Socket.IO server.

**CRITICAL — DO NOT REBUILD THE UI FROM SCRATCH:**
An exported UI prototype from **v0.dev** is already located in the `prototype/` directory at the repository root. You MUST **reuse and adapt the existing Tailwind CSS styles, color palette, typography, layout structure, modals, drawers, and UI components from `prototype/`** rather than inventing a new design from scratch.

- Inspect `prototype/package.json`, `prototype/tailwind.config.*`, `prototype/app/globals.css` (or `src/index.css`), and `prototype/components/` first.
- Preserve the exact Tailwind CSS utility classes, CSS variables (`--background`, `--foreground`, `--primary`, etc. if present), and installed UI dependencies (such as `lucide-react`, `clsx`, `tailwind-merge`, `class-variance-authority`, or Radix/shadcn primitives) used in `prototype/`.
- Port the prototype's Next.js/v0 client components cleanly into a **React + Vite + Tailwind CSS** project inside `frontend/` (removing any Next.js-specific imports like `next/font` or `"use client"` if unnecessary), organizing them into the modular folder structure below and replacing hardcoded mock data with real API calls and WebSocket real-time synchronization.

---

## 2. Target Folder Structure (`frontend/`)

Organize `frontend/` following a clean feature-modular architecture while keeping reusable UI primitives (like shadcn/ui components from `prototype/components/ui/`) intact:

```text
frontend/
├── .env                          # VITE_API_BASE_URL=http://localhost:5000/api/v1 & VITE_SOCKET_URL=http://localhost:5000
├── .env.sample
├── .gitignore
├── index.html
├── package.json
├── vite.config.js (or .ts)
├── tailwind.config.js (or .ts)
├── postcss.config.js
└── src/
    ├── main.jsx (or .tsx)         # Entry point
    ├── App.jsx (or .tsx)          # Root layout, toast provider & board view
    ├── index.css                  # Tailwind CSS directives & theme variables copied from prototype/
    ├── config/
    │   └── env.js                 # Centralized API_BASE_URL and SOCKET_URL config
    ├── services/
    │   ├── apiClient.js           # Axios/Fetch wrapper with error interceptor (400, 404, 422, 500)
    │   ├── authService.js         # GET /auth/users, POST /auth/login, POST /auth/register
    │   ├── boardService.js        # GET /boards, GET /boards/:id, GET /boards/assets
    │   ├── ticketService.js       # GET /tickets, POST /tickets, PATCH /tickets/:id/status, PATCH /tickets/:id, GET /tickets/:id/history
    │   └── socketService.js       # Socket.IO client listening to 'ticket_updated' events
    ├── hooks/
    │   ├── useBoardData.js        # Fetches board lists/tickets, handles filters & real-time socket refreshes
    │   └── useActiveUser.js       # Manages active user switcher state (persisted in localStorage)
    ├── utils/
    │   ├── stateMachine.js        # Client-side state transition guard (mirrors backend rules)
    │   ├── formatters.js          # Date/timestamp formatting and priority/status badge helpers
    │   └── cn.js                  # Tailwind class merge helper (clsx + tailwind-merge from prototype)
    └── components/
        ├── ui/                    # Reusable Tailwind/shadcn primitives copied directly from prototype/components/ui/
        ├── layout/
        │   ├── Navbar.jsx         # Ported from prototype: App title, active user switcher, "+ New Ticket" button
        │   └── FilterBar.jsx      # Ported from prototype: KPI counters + Search, Priority, Asset Code & Operator filters
        ├── board/
        │   ├── KanbanBoard.jsx    # Drag-and-Drop context provider (@hello-pangea/dnd or @dnd-kit/core)
        │   ├── KanbanColumn.jsx   # Droppable list column (PENDING, IN_PROGRESS, RESOLVED) styled with prototype Tailwind classes
        │   └── TicketCard.jsx     # Draggable ticket card styled with prototype Tailwind classes
        └── modals/
            ├── CreateTicketModal.jsx     # Ported from prototype -> wired to POST /api/v1/tickets
            ├── ResolveTicketModal.jsx    # Ported from prototype -> mandatory diagnosis modal for IN_PROGRESS -> RESOLVED
            └── TicketDetailDrawer.jsx    # Ported from prototype -> ticket details, operator assignment & Ticket_History timeline

```

## 3. Backend API Contract Integration

Connect every UI action to the existing Flask endpoints:

- **Users / Active Operator Switcher (`authService.js`):**
  - Load users on mount via `GET /api/v1/auth/users`.
  - Allow switching the active user in the Navbar (`Juan Perez`, `Luis Paredes`, `Maria Lopez`, etc.). Pass the selected user's `full_name` as `created_by` (when creating tickets) and `changed_by` (when transitioning or editing tickets).

- **Board, Lists & Assets (`boardService.js`):**
  - Load the active board via `GET /api/v1/boards/1` (returns ordered lists: `PENDING`, `IN_PROGRESS`, `RESOLVED`, each containing its ordered tickets).
  - Load existing asset codes via `GET /api/v1/boards/assets` to populate filter dropdowns and autocomplete suggestions in `CreateTicketModal`.

- **Create Ticket (`CreateTicketModal.jsx` -> `POST /api/v1/tickets`):**
  - **Payload:** `{ title, description, priority, asset_code, list_id, assigned_to, created_by }`.
  - Refresh board state upon `201 Created` and show a success toast.

- **Update Ticket Metadata (`TicketDetailDrawer.jsx` -> `PATCH /api/v1/tickets/:id`):**
  - Allow updating `assigned_to`, `priority`, `title`, `description`, or `diagnosis`, then reload the ticket's audit history.

- **Audit Trail (`TicketDetailDrawer.jsx` -> `GET /api/v1/tickets/:id/history`):**
  - Display the complete chronological `Ticket_History` (`previous_status` -> `new_status`, `comment`, `changed_by`, `created_at`).

---

## 4. Drag-and-Drop & State Machine Requirements (CRITICAL)

Wrap the prototype's Kanban columns and ticket cards with accessible Drag-and-Drop (`@hello-pangea/dnd` or `@dnd-kit/core`, compatible with React 18/19), preserving the visual feedback and Tailwind styling from `prototype/`:

- **Client-Side Guard + Backend Enforcement (`stateMachine.js`):**
  - **`PENDING` -> `RESOLVED`:** Immediately block the drop on the client with an error toast (`"Invalid transition: Tickets must pass through IN_PROGRESS before being RESOLVED."`) and snap the card back without calling the API.
  - **`RESOLVED` -> `PENDING` or `IN_PROGRESS`:** Block moving closed tickets out of `RESOLVED` with an error toast (`"Closed tickets cannot be reopened directly."`).
  - **`IN_PROGRESS` -> `RESOLVED`:** Intercept the drop and open `ResolveTicketModal.jsx` requiring a non-empty **Technical Diagnosis** and an optional **Comment**.
    - If the user cancels the modal, snap the card back to `IN_PROGRESS`.
    - If confirmed, call `PATCH /api/v1/tickets/:id/status` with `{ target_list_id, position, diagnosis, comment, changed_by }`.
  - **`PENDING` -> `IN_PROGRESS` or `IN_PROGRESS` -> `PENDING`:** Execute optimistic UI update and call `PATCH /api/v1/tickets/:id/status` with `{ target_list_id, position, comment, changed_by }`.
  - **Same-Column Reorder:** Call `PATCH /api/v1/tickets/:id/status` with the same `target_list_id` and updated `position`.

- **Backend Error Handling (`422` / `400` / `500`):**
  - If the backend rejects any transition with `HTTP 422 Unprocessable Entity`, revert the optimistic card position and display the backend's message in a toast notification.

- **Real-Time WebSocket Sync (`socketService.js`):**
  - Connect to `VITE_SOCKET_URL` via `socket.io-client`.
  - Subscribe to `ticket_updated` events emitted by the backend (`websockets/board_events.py`) and automatically re-fetch the board (`GET /api/v1/boards/1`) so changes made in another browser tab appear live without manual page reload.

---

## 5. Execution Steps for Claude Code

1. Inspect `prototype/` (`package.json`, Tailwind config, global CSS, and components) to reuse its exact Tailwind CSS styling, theme tokens, and UI primitives without rewriting the UI from scratch.
2. Scaffold `frontend/` with Vite + React + Tailwind CSS, installing the UI packages detected in `prototype/` plus `socket.io-client` and `@hello-pangea/dnd` (or `@dnd-kit/core`).
3. Port and modularize the prototype components into the folder structure in Section 2, keeping all labels, messages, and code in English.
4. Wire all services (`authService`, `boardService`, `ticketService`, `socketService`) to the Flask backend endpoints.
5. Create `frontend/.env` and `frontend/.env.sample` pointing to `http://localhost:5000/api/v1` and `http://localhost:5000`.
6. Run `npm run build` inside `frontend/` to verify zero compilation errors and validate end-to-end integration against the running Flask backend.
