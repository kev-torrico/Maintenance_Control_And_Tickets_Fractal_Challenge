Create a modern, clean, and interactive web prototype for a "Maintenance Control and Tickets System" (Enterprise Infrastructure & ATM Operations Dashboard). Use English for all UI labels, buttons, statuses, and mock data.

### Layout & Visual Style

- Clean enterprise SaaS aesthetic (light mode, crisp slate/white cards, subtle borders, Tailwind CSS, Lucide icons).
- **Top Navbar:**
  - App title: "Maintenance & Infrastructure Control" with a wrench/shield icon.
  - Active User Switcher dropdown in the top-right corner with 3 preloaded users:
    1. "Juan Perez (Operator)" [default selected]
    2. "Luis Paredes (Operator)"
    3. "Maria Lopez (Reporter)"
  - Primary CTA button: "+ New Ticket".
- **Filter & KPI Summary Bar:**
  - Compact metric badges showing count of Pending, In Progress, and Resolved tickets.
  - Filter bar with: Search input (by title or asset code), Priority filter (`All`, `LOW`, `MEDIUM`, `HIGH`), Asset Code filter (`All`, `ATM-0451`, `SEDE-LIM`, `SEDE-ARE`, `ATM-0210`), and Operator filter.

### Main View: 3-Column Kanban Board

Render 3 distinct columns representing the ticket lifecycle:

1. **PENDING** (Amber/Yellow badge)
2. **IN_PROGRESS** (Blue badge)
3. **RESOLVED** (Emerald/Green badge)

Prepopulate the board with these exact 4 tickets:

- **Ticket #1 (Column: PENDING):**
  - Title: "Cajero fuera de servicio"
  - Asset Code: `ATM-0451` | Priority: `HIGH`
  - Description: "Pantalla sin respuesta al iniciar transacción."
  - Assigned to: "Juan Perez"
  - History: [Created by Maria Lopez -> PENDING]
- **Ticket #2 (Column: PENDING):**
  - Title: "Fuga en tubería piso 2"
  - Asset Code: `SEDE-LIM` | Priority: `MEDIUM`
  - Description: "Filtración detectada cerca del cuarto de servidores."
  - Assigned to: "Unassigned"
  - History: [Created by Maria Lopez -> PENDING]
- **Ticket #3 (Column: IN_PROGRESS):**
  - Title: "UPS con alarma"
  - Asset Code: `SEDE-ARE` | Priority: `HIGH`
  - Description: "Batería de respaldo emitiendo alerta sonora intermitente."
  - Assigned to: "Luis Paredes"
  - History: [Created by Maria Lopez -> PENDING], [Moved to IN_PROGRESS by Juan Perez: "Revisando banco de baterías del UPS."]
- **Ticket #4 (Column: RESOLVED):**
  - Title: "Cambio de lector de tarjeta"
  - Asset Code: `ATM-0210` | Priority: `MEDIUM`
  - Description: "Lector magnético desgastado, requiere reemplazo."
  - Assigned to: "Luis Paredes"
  - Diagnosis: "Lector magnético reemplazado y calibrado con pruebas exitosas."
  - History: [Created -> PENDING], [PENDING -> IN_PROGRESS], [IN_PROGRESS -> RESOLVED by Luis Paredes]

Each ticket card must display: Ticket ID (`#1`), Asset Code pill (`ATM-0451`), Priority badge (`HIGH`/`MEDIUM`/`LOW`), Title, Assigned Operator avatar/name, and quick action buttons to advance/change status or open details.

### Interactive Modals & State Machine Business Rules (Must be interactive!)

1. **Create Ticket Modal (`+ New Ticket`):**
   - Form fields: Title, Asset Code (input with suggestions like `ATM-0451`, `SEDE-LIM`), Priority (`LOW`, `MEDIUM`, `HIGH`), Description, and Assigned Operator (optional).
   - Submitting adds the new ticket to `PENDING` and appends an initial entry to its Audit History using the currently selected Top Navbar user.
2. **State Transition & Validation Rules (Interactive):**
   - **Rule A (No skipping states):** Moving a ticket directly from `PENDING` to `RESOLVED` must be blocked with a clear toast/alert: `"Invalid transition: Tickets must pass through IN_PROGRESS before being RESOLVED."`
   - **Rule B (Mandatory Diagnosis for RESOLVED):** When transitioning a ticket from `IN_PROGRESS` to `RESOLVED`, open a confirmation modal requiring a **Technical Diagnosis** textarea and an optional **Transition Comment**. If the user tries to confirm with an empty diagnosis, show a validation error: `"Technical diagnosis is required before marking a ticket as RESOLVED."`
   - **Rule C (Closed tickets):** Tickets in `RESOLVED` cannot be moved back to `PENDING` or `IN_PROGRESS`.
3. **Ticket Detail & Audit Trail Drawer/Modal (Clicking any card):**
   - Displays full ticket metadata, editable Assigned Operator dropdown, Technical Diagnosis box, and a vertical **Timeline / Audit Trail (`Ticket_History`)** showing `previous_status -> new_status`, `comment`, `changed_by` (user full name), and timestamp.
