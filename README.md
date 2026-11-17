# Maintenance Control & Tickets System

> **DTP-L2-2026** — Full-stack Kanban platform for infrastructure maintenance tickets (ATMs, branches, facilities) with an enforced workflow, mandatory technical diagnosis and a complete audit trail.

![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.0-000000?logo=flask)
![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?logo=mysql&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)

---

## Table of Contents

1. [Project Overview & Problem Statement](#1-project-overview--problem-statement)
2. [System Architecture & Tech Stack](#2-system-architecture--tech-stack)
3. [Repository Folder Structure](#3-repository-folder-structure)
4. [Domain Business Rules & State Machine](#4-domain-business-rules--state-machine)
5. [Local Setup & Execution Guide](#5-local-setup--execution-guide)
6. [API Endpoints Summary](#6-api-endpoints-summary)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Project Overview & Problem Statement

Maintenance teams that track incidents in spreadsheets, chats or e-mail suffer from three recurring problems:

| Problem | How this system solves it |
|---|---|
| **Operational blind spots** — nobody knows which assets are failing, who is working on what, or what is still waiting. | A shared, real-time **Kanban board** (`Pending → In progress → Resolved`) with KPI counters and filters by priority, asset code and operator. Every change is pushed live to all connected clients via **WebSockets**. |
| **Premature ticket closures** — tickets are marked "done" without any record of what was actually repaired. | A **State Machine** enforced at three layers (React UI, Flask service, MySQL Stored Procedure) makes a **technical diagnosis mandatory** before a ticket can reach `RESOLVED`, forbids skipping `IN_PROGRESS` and prevents reopening closed tickets. |
| **No traceability** — it is impossible to reconstruct who changed what and when. | Every creation, transition, reassignment and diagnosis change is written **atomically** to an immutable `ticket_history` audit trail, displayed as a timeline in the ticket detail drawer. |

Users act under one of two board roles:

- **`REPORTER`** — reports incidents (creates tickets) and follows their progress.
- **`OPERATOR`** — works the tickets: the **only role allowed to move tickets** between columns or change their status.

---

## 2. System Architecture & Tech Stack

```text
┌──────────────────────────────┐   REST (JSON) /api/v1    ┌──────────────────────────────┐   SQLAlchemy + PyMySQL   ┌──────────────────────────────┐
│  Frontend (React + Vite)     │ ───────────────────────► │  Backend (Flask REST API)    │ ───────────────────────► │  MySQL 8.x                   │
│  http://localhost:5173       │                          │  http://localhost:5000       │   CALL sp_create_ticket  │  maintenance_tickets_db      │
│                              │ ◄─────────────────────── │                              │   CALL sp_transition_... │                              │
│  • Kanban + Drag-and-Drop    │   Socket.IO              │  • Layered modules           │                          │  • Normalized schema         │
│  • Client state machine      │   "ticket_updated"       │  • Python state machine      │                          │  • Atomic Stored Procedures  │
│  • socket.io-client          │                          │  • Flask-SocketIO, Flasgger  │                          │  • ticket_history audit      │
└──────────────────────────────┘                          └──────────────────────────────┘                          └──────────────────────────────┘
```

### Database — MySQL 8.x (`backend/database/`)

Normalized schema (`01_schema.sql`):

| Table | Purpose |
|---|---|
| `app_user` | Users (`full_name`, unique `email`). |
| `board` | Kanban boards (`ACTIVE` / `INACTIVE`). |
| `user_board` | User ↔ board membership with role `REPORTER` or `OPERATOR` (unique per user/board). |
| `board_list` | Board columns; the list **title is the workflow status** (`PENDING`, `IN_PROGRESS`, `RESOLVED`), ordered by `position`. |
| `asset_code` | Unique asset identifiers (e.g. `ATM-0451`, `SEDE-LIM`), normalized to uppercase. |
| `ticket` | Core entity: title, description, priority (`LOW`/`MEDIUM`/`HIGH`), status, diagnosis, assignee, asset, list and position. |
| `ticket_history` | Immutable audit trail: `previous_status → new_status`, `comment`, `changed_by` (user `full_name` snapshot), `created_at`. |

Atomic Stored Procedures (`02_stored_procedures.sql`), each running in its own transaction with `ROLLBACK` + `RESIGNAL` on error:

| Procedure | Behavior |
|---|---|
| `sp_create_ticket(p_title, p_description, p_priority, p_asset_code_name, p_list_id, p_assigned_to, p_created_by)` | Validates the target list, finds or creates the asset code (uppercase), appends the ticket at the bottom of the list, writes the initial `ticket_history` row (`NULL → <status>`) and returns `ticket_id`, `status`. |
| `sp_transition_ticket_status(p_ticket_id, p_target_list_id, p_new_position, p_diagnosis, p_comment, p_changed_by)` | Locks the ticket row (`SELECT … FOR UPDATE`), derives the target status from the list title, re-validates the state machine and the diagnosis rule, updates list/status/position/diagnosis and writes an audit row when the status changes or a comment is given. |

`03_seed.sql` loads demo data: board **"Maintenance & Infrastructure Control"**, its three lists, four tickets (created and transitioned through the Stored Procedures) and these users:

| User | E-mail | Role on board 1 |
|---|---|---|
| Juan Perez | `juan.perez@fractal.com` | `OPERATOR` |
| Luis Paredes | `luis.paredes@fractal.com` | `OPERATOR` |
| Maria Lopez | `maria.lopez@fractal.com` | `REPORTER` |

### Backend — Python / Flask REST API (`backend/`)

- **Flask 3** application factory (`app/__init__.py`) with three feature modules — `auth`, `boards`, `tickets` — each split into strict layers:

  | Layer | Responsibility |
  |---|---|
  | `routes/` | Flask Blueprints exposing the REST endpoints. |
  | `controllers/` | HTTP parsing, input validation, standardized JSON responses. |
  | `services/` | Business logic, role checks, state machine, SQLAlchemy queries and Stored Procedure execution. |
  | `models/` | SQLAlchemy ORM models mapping the exact MySQL tables. |
  | `utils/` | Pure validators, serializers and the ticket State Machine. |

- `app/shared/` — domain exceptions (`BadRequestException` 400, `ForbiddenException` 403, `NotFoundException` 404, `BusinessRuleException` 422), global error handlers (no stack traces leak to clients) and the response envelope.
- **SQLAlchemy** (Flask-SQLAlchemy) + **PyMySQL**; ticket creation and status transitions **always** go through the Stored Procedures (`CALL …` via `sqlalchemy.text`).
- **Flasgger** serves the OpenAPI 3.0 contract in `swagger_docs/openapi.yaml` at **`/apidocs/`**.
- **Flask-SocketIO** (`websockets/`) broadcasts a `ticket_updated` event after every create / update / assign / transition.
- **Flask-CORS** restricts `/api/*` to the origins configured in `CORS_ORIGINS`.

### Frontend — React + Vite + Tailwind CSS (`frontend/`)

- **React 19 + Vite 8**, styled with **Tailwind CSS v4** and the theme tokens, classes and UI primitives ported from the v0 prototype (`prototype/`): `@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`.
- **Accessible drag-and-drop** with `@hello-pangea/dnd` (mouse, touch and keyboard: <kbd>Space</kbd> to lift, arrows to move, <kbd>Space</kbd> to drop) across and within columns, with optimistic updates and automatic rollback on API errors.
- **Client-side state machine guards** (`src/utils/stateMachine.js`) that mirror the backend rules and open a mandatory **Technical Diagnosis** modal for `In progress → Resolved`.
- **Role-aware UI**: the active user is chosen in the navbar (persisted in `localStorage`); `REPORTER`s can create and review tickets but cannot drag or transition them.
- **Real-time sync** with `socket.io-client`: every `ticket_updated` event re-fetches the board (and the open ticket drawer).
- Ticket detail drawer with metadata editing, operator assignment and the full `ticket_history` timeline.

---

## 3. Repository Folder Structure

```text
Maintenance_Control_And_Tickets_Fractal_Challenge/
├── backend/                                # Flask REST API + Socket.IO server
│   ├── app/
│   │   ├── __init__.py                     # App factory: CORS, DB, Socket.IO, Swagger, blueprints
│   │   ├── models.py                       # Central ORM model registry
│   │   ├── modules/
│   │   │   ├── auth/                       # /api/v1/auth     (users, login, register)
│   │   │   ├── boards/                     # /api/v1/boards   (boards, lists, asset codes)
│   │   │   └── tickets/                    # /api/v1/tickets  (tickets, transitions, history)
│   │   │       ├── controllers/
│   │   │       ├── models/                 # Ticket, TicketHistory
│   │   │       ├── routes/
│   │   │       ├── services/               # ticket_service.py → Stored Procedures
│   │   │       └── utils/                  # state_machine.py, validators.py, serializers.py
│   │   └── shared/                         # exceptions, error handlers, responses, validators
│   ├── config/
│   │   ├── database.py                     # SQLAlchemy + Flask-Migrate instances
│   │   └── settings.py                     # Environment-based configuration
│   ├── database/
│   │   ├── 01_schema.sql                   # Database + tables
│   │   ├── 02_stored_procedures.sql        # sp_create_ticket, sp_transition_ticket_status
│   │   └── 03_seed.sql                     # Demo board, lists, users and tickets
│   ├── swagger_docs/
│   │   └── openapi.yaml                    # OpenAPI 3.0 contract served at /apidocs/
│   ├── websockets/
│   │   ├── __init__.py                     # SocketIO instance
│   │   └── board_events.py                 # emit_ticket_moved() → "ticket_updated"
│   ├── .env.sample
│   ├── requirements.txt
│   └── run.py                              # Entry point (port 5000)
│
├── frontend/                               # React + Vite + Tailwind CSS client
│   ├── public/                             # Favicons
│   ├── src/
│   │   ├── components/
│   │   │   ├── board/                      # KanbanBoard, KanbanColumn, TicketCard (drag-and-drop)
│   │   │   ├── layout/                     # Navbar (user switcher), FilterBar (KPIs + filters)
│   │   │   ├── modals/                     # CreateTicketModal, ResolveTicketModal, TicketDetailDrawer
│   │   │   └── ui/                         # button (shadcn port), modal, toast
│   │   ├── config/env.js                   # API_BASE_URL, SOCKET_URL, DEFAULT_BOARD_ID
│   │   ├── hooks/                          # useActiveUser, useBoardData
│   │   ├── services/                       # apiClient, authService, boardService, ticketService, socketService
│   │   ├── utils/                          # stateMachine, formatters, cn
│   │   ├── App.jsx                         # Dashboard composition + toast provider
│   │   ├── index.css                       # Tailwind directives + prototype theme
│   │   └── main.jsx                        # Entry point
│   ├── .env.sample
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.js                      # Dev server on port 5173, "@" → src/
│
├── prototype/                              # v0.dev UI prototype (design reference only)
├── prompts/                                # FRONTEND_SPECS.md, FRONTEND_PROTOTYPE.md
├── ERD/                                    # Entity-Relationship diagrams
├── LLD/                                    # Low-level design / sequence diagrams (PlantUML)
└── README.md
```

---

## 4. Domain Business Rules & State Machine

```text
                 ┌──────────── return / re-queue ────────────┐
                 ▼                                           │
          ┌─────────────┐   start work   ┌───────────────┐   │   resolve (diagnosis required)   ┌──────────────┐
 create ─►│   PENDING   │ ─────────────► │  IN_PROGRESS  │ ──┴────────────────────────────────► │   RESOLVED   │ (closed)
          └─────────────┘                └───────────────┘                                      └──────────────┘
                 │                                                                                     ▲
                 └──────────────────────────────── ✖ forbidden (cannot skip IN_PROGRESS) ──────────────┘
```

| Transition | Result |
|---|---|
| `PENDING → IN_PROGRESS` | ✅ Allowed |
| `IN_PROGRESS → PENDING` | ✅ Allowed (ticket returned / re-queued) |
| `IN_PROGRESS → RESOLVED` | ✅ Allowed **only if** a non-empty `diagnosis` is sent in the request **or** is already stored on the ticket |
| Same status → same status | ✅ Allowed (reordering inside a column) |
| `PENDING → RESOLVED` | ❌ `422` — tickets must pass through `IN_PROGRESS` |
| `RESOLVED → PENDING` / `RESOLVED → IN_PROGRESS` | ❌ `422` — closed tickets cannot be reopened |
| Any transition to `RESOLVED` without diagnosis | ❌ `422` |

**Additional rules**

- **Role rule:** only users with the `OPERATOR` role on the ticket's board can move tickets (status changes and reordering). The acting user is identified by `changed_by_id`; any other role receives **`403 Forbidden`**.
- **Defense in depth:** the rules are enforced by the React client (instant feedback, card snaps back), by the Python state machine (`tickets/utils/state_machine.py`, before calling the database) and again inside `sp_transition_ticket_status`.
- **Diagnosis integrity:** the diagnosis of a `RESOLVED` ticket cannot be cleared (`422`).
- **Automatic audit trail** in `ticket_history`:
  - ticket creation → `NULL → PENDING` (written by `sp_create_ticket`);
  - every status change → `previous → new` with the comment (default: *"Status changed from Pending to In progress."*);
  - operator (re)assignment and diagnosis edits → entry with the same status and a descriptive comment;
  - `changed_by` stores a snapshot of the acting user's `full_name`.

---

## 5. Local Setup & Execution Guide

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| **Docker** | Any recent version | Runs MySQL 8 (alternatively use a local MySQL 8.x server). |
| **Python** | **3.10+** | Tested with 3.11. |
| **Node.js** | **20.19+ or 22.12+** | Required by Vite 8 (`"node": "^20.19.0 \|\| >=22.12.0"`). Node 18 is **not** supported. |
| **npm** | Bundled with Node.js | |

All commands below are run from the **repository root** unless stated otherwise.

### Step 1 — Database Setup (MySQL 8 via Docker)

**1.1 Start a MySQL 8.4 container** (creates the database and an application user `maintenance`):

```bash
docker run -d --name maintenance-mysql -e MYSQL_ROOT_PASSWORD=rootpass -e MYSQL_DATABASE=maintenance_tickets_db -e MYSQL_USER=maintenance -e MYSQL_PASSWORD=maintenance_pass -p 3306:3306 mysql:8.4 --character-set-server=utf8mb4 --collation-server=utf8mb4_unicode_ci
```

Wait until the server is ready (repeat until it prints `mysqld is alive`):

```bash
docker exec maintenance-mysql mysqladmin ping -h 127.0.0.1 -uroot -prootpass
```

**1.2 Copy the SQL scripts into the container and run them in this exact order** (as `root`, because the scripts create the schema and the Stored Procedures):

```bash
docker cp backend/database/. maintenance-mysql:/tmp/database/

docker exec maintenance-mysql sh -c "mysql --default-character-set=utf8mb4 -uroot -prootpass < /tmp/database/01_schema.sql"
docker exec maintenance-mysql sh -c "mysql --default-character-set=utf8mb4 -uroot -prootpass < /tmp/database/02_stored_procedures.sql"
docker exec maintenance-mysql sh -c "mysql --default-character-set=utf8mb4 -uroot -prootpass < /tmp/database/03_seed.sql"
```

> These commands work the same in PowerShell, CMD and Bash (the `<` redirection runs inside the container).
> On **Git Bash for Windows**, run `export MSYS_NO_PATHCONV=1` first so `/tmp/...` paths are not rewritten.
> `03_seed.sql` truncates all tables, so you can re-run it at any time to reset the demo data.

**1.3 Verify:**

```bash
docker exec maintenance-mysql mysql --default-character-set=utf8mb4 -umaintenance -pmaintenance_pass maintenance_tickets_db -e "SELECT id, title, status FROM ticket;"
```

You should see 4 tickets (`PENDING`, `PENDING`, `IN_PROGRESS`, `RESOLVED`).

### Step 2 — Backend Setup (Flask API)

**2.1 Create and activate a virtual environment** inside `backend/`:

Windows (PowerShell):

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
```

Linux / macOS:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
```

**2.2 Install dependencies:**

```bash
pip install -r requirements.txt
```

**2.3 Configure environment variables** — copy the sample file:

```bash
# Linux / macOS
cp .env.sample .env
```

```powershell
# Windows (PowerShell)
Copy-Item .env.sample .env
```

Then edit `backend/.env` with the credentials from Step 1:

```dotenv
# Flask Application
FLASK_APP=run.py
FLASK_ENV=development
SECRET_KEY=change-me

# MySQL Database Connection
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=maintenance
DB_PASSWORD=maintenance_pass
DB_NAME=maintenance_tickets_db

# CORS Allowed Origins (comma-separated)
CORS_ORIGINS=http://localhost:5173
```

| Variable | Description |
|---|---|
| `SECRET_KEY` | Flask secret key. |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection (driver `mysql+pymysql`, charset `utf8mb4`). |
| `CORS_ORIGINS` | Comma-separated origins allowed to call `/api/*` (the Vite dev server). |
| `MYSQL_URL` / `DATABASE_URL` | *Optional.* A full connection URL (e.g. `mysql://user:pass@host:3306/db`) that overrides the `DB_*` variables. |

**2.4 Start the server:**

```bash
python run.py
```

| URL | Description |
|---|---|
| `http://localhost:5000` | API + Socket.IO server |
| `http://localhost:5000/api/v1/health` | Health check → `{"status": "ok", "service": "maintenance-tickets-api"}` |
| `http://localhost:5000/apidocs/` | Swagger UI (interactive OpenAPI documentation) |

### Step 3 — Frontend Setup (React + Vite)

Open a **second terminal**:

**3.1 Install dependencies:**

```bash
cd frontend
npm install
```

**3.2 Configure environment variables:**

```bash
# Linux / macOS
cp .env.sample .env
```

```powershell
# Windows (PowerShell)
Copy-Item .env.sample .env
```

```dotenv
# Flask REST API base URL (includes the /api/v1 prefix)
VITE_API_BASE_URL=http://localhost:5000/api/v1

# Flask-SocketIO server URL (real-time board sync)
VITE_SOCKET_URL=http://localhost:5000

# Board displayed by the Kanban view
VITE_DEFAULT_BOARD_ID=1
```

**3.3 Start the development server:**

```bash
npm run dev
```

Open **`http://localhost:5173`**. Pick an active user in the navbar (e.g. *Juan Perez (Operator)* to move tickets, *Maria Lopez (Reporter)* to see the read-only workflow). Open the app in two browser tabs to watch real-time synchronization.

Other scripts:

| Command | Description |
|---|---|
| `npm run build` | Production build into `frontend/dist/` |
| `npm run preview` | Serve the production build locally |

---

## 6. API Endpoints Summary

Base URL: `http://localhost:5000/api/v1` — full request/response schemas at **`/apidocs/`**.

### Auth — `/api/v1/auth`

| Method | Endpoint | Description | Success |
|---|---|---|---|
| `GET` | `/auth/users` | List users with their board roles. Optional `?role=OPERATOR\|REPORTER`. | `200` |
| `POST` | `/auth/login` | Body `{ "email" }` → user details (`id`, `full_name`, `email`, `role`). `404` if unknown. | `200` |
| `POST` | `/auth/register` | Body `{ "full_name", "email", "role" }`; links the user to board `1`. `400` if the e-mail exists. | `201` |

### Boards — `/api/v1/boards`

| Method | Endpoint | Description | Success |
|---|---|---|---|
| `GET` | `/boards` | List active boards. | `200` |
| `GET` | `/boards/{board_id}` | Full board: lists ordered by position, each with its ordered tickets (incl. `asset_code` and `assigned_user`). | `200` |
| `GET` | `/boards/assets` | Registered asset codes (`id`, `name`). Optional `?search=`. | `200` |

### Tickets — `/api/v1/tickets`

| Method | Endpoint | Description | Success |
|---|---|---|---|
| `GET` | `/tickets` | List tickets. Filters: `?status=`, `?priority=`, `?asset_code=`, `?assigned_to=`, `?search=`. | `200` |
| `POST` | `/tickets` | Create via `sp_create_ticket`. Body: `title`, `description`, `asset_code`, `created_by` (required); `priority`, `list_id` (default `1`), `assigned_to` (optional). | `201` |
| `GET` | `/tickets/{ticket_id}` | Ticket detail with `asset_code`, `assigned_user`, `list` and chronological `history`. | `200` |
| `PATCH` | `/tickets/{ticket_id}` | Update metadata: `title`, `description`, `priority`, `assigned_to`, `diagnosis`. Changing `assigned_to`/`diagnosis` requires `changed_by` and writes an audit entry. | `200` |
| `PATCH` | `/tickets/{ticket_id}/status` | Move/transition via `sp_transition_ticket_status`. Body: `target_list_id`, `changed_by_id` (OPERATOR) required; `position`, `diagnosis`, `comment` optional. | `200` |
| `GET` | `/tickets/{ticket_id}/history` | Complete chronological audit trail. | `200` |

Example — resolve a ticket:

```bash
curl -X PATCH http://localhost:5000/api/v1/tickets/3/status \
  -H "Content-Type: application/json" \
  -d '{"target_list_id": 3, "diagnosis": "Battery bank replaced and load-tested.", "comment": "UPS back to normal.", "changed_by_id": 1}'
```

### Response format & error codes

```jsonc
// Success
{ "success": true,  "message": "Ticket status updated successfully.", "data": { ... } }
// Error
{ "success": false, "error": "Unprocessable Entity", "message": "A technical diagnosis is required before marking a ticket as Resolved.", "details": { ... } }
```

| Code | Meaning |
|---|---|
| `400` | Missing required fields, invalid JSON or malformed parameters |
| `403` | The acting user is not an `OPERATOR` (ticket transitions) |
| `404` | User, board, list or ticket not found |
| `422` | Business rule / State Machine violation |
| `500` | Unexpected server error (no stack trace exposed) |

### WebSocket events (Socket.IO — `http://localhost:5000`)

| Event | Direction | Emitted when | Payload |
|---|---|---|---|
| `ticket_updated` | server → clients | A ticket is created, updated/assigned or transitioned | `action` (`ticket_created` \| `ticket_updated` \| `ticket_moved`), `ticket_id`, `board_id`, `from_list_id`, `to_list_id`, `status`, `position`, `ticket` (serialized ticket); plus `previous_status` (moves) or `updated_fields` (updates) |

The frontend listens to `ticket_updated` and re-fetches `GET /api/v1/boards/{board_id}` so every open browser stays in sync.

---

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `docker run` fails: port `3306` already in use | A local MySQL is running. Map another port (`-p 3307:3306`) and set `DB_PORT=3307` in `backend/.env`. |
| `Activate.ps1 cannot be loaded because running scripts is disabled` | Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned` in that PowerShell session, then activate again. |
| Browser shows CORS errors | Make sure `CORS_ORIGINS` in `backend/.env` contains the exact frontend origin (`http://localhost:5173`) and restart the backend. |
| Board shows "Unable to reach the server" | The backend is not running or `VITE_API_BASE_URL` is wrong. Restart `npm run dev` after editing `frontend/.env`. |
| `npm run dev` fails with an engine/syntax error | Upgrade Node.js to 20.19+ or 22.12+. |
| Cards cannot be dragged | The active user is a `REPORTER`. Switch to an operator in the navbar. |
