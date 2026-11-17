import { useEffect, useRef } from "react"
import { Activity, Clock3, HardHat, Search, SlidersHorizontal, TicketCheck, X } from "lucide-react"
import { PRIORITIES } from "@/utils/formatters"

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "")

/** KPI counters (prototype `.stats-row`). */
export function StatsRow({ stats }) {
  return (
    <section className="stats-row" aria-label="Ticket summary">
      <div className="stat-card">
        <div className="stat-icon amber-icon"><Clock3 size={17} /></div>
        <div className="stat-label">Pending</div>
        <div className="stat-number">{stats.PENDING}<span>tickets</span></div>
        <div className="stat-foot"><span className="stat-dot amber-dot" /> Awaiting assignment or review</div>
      </div>
      <div className="stat-card">
        <div className="stat-icon blue-icon"><Activity size={17} /></div>
        <div className="stat-label">In progress</div>
        <div className="stat-number">{stats.IN_PROGRESS}<span>tickets</span></div>
        <div className="stat-foot"><span className="stat-dot blue-dot" /> Currently being worked on</div>
      </div>
      <div className="stat-card">
        <div className="stat-icon green-icon"><TicketCheck size={17} /></div>
        <div className="stat-label">Resolved</div>
        <div className="stat-number">{stats.RESOLVED}<span>tickets</span></div>
        <div className="stat-foot"><span className="stat-dot green-dot" /> Successfully completed</div>
      </div>
      <div className="stat-card total-stat">
        <div className="stat-icon slate-icon"><HardHat size={17} /></div>
        <div className="stat-label">All tickets</div>
        <div className="stat-number">{stats.total}<span>total</span></div>
        <div className="stat-foot">Across all assets &amp; locations</div>
      </div>
    </section>
  )
}

/** Board title + Search, Priority, Asset code and Operator filters (prototype `.board-title-row`). */
export function BoardControls({ filters, onChange, onReset, hasActiveFilters, assetOptions, operators }) {
  const searchRef = useRef(null)

  // ⌘K / Ctrl+K focuses the search box (as advertised by the prototype's <kbd>).
  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  const update = (key) => (event) => onChange({ ...filters, [key]: event.target.value })

  return (
    <div className="board-title-row">
      <div>
        <h2>Ticket board</h2>
        <p>Manage your team&apos;s maintenance workflow</p>
      </div>
      <div className="board-controls">
        <div className="search-box">
          <Search size={16} />
          <input
            ref={searchRef}
            aria-label="Search tickets"
            placeholder="Search tickets…"
            value={filters.search}
            onChange={update("search")}
            onKeyDown={(event) => event.key === "Escape" && onChange({ ...filters, search: "" })}
          />
          <kbd>{isMac ? "⌘ K" : "Ctrl K"}</kbd>
        </div>
        <span className="control-divider" />
        <SlidersHorizontal size={15} className="filter-icon" />
        <select aria-label="Filter by priority" value={filters.priority} onChange={update("priority")}>
          <option value="All">All priorities</option>
          {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
        </select>
        <select aria-label="Filter by asset" value={filters.assetCode} onChange={update("assetCode")}>
          <option value="All">All assets</option>
          {assetOptions.map((asset) => <option key={asset} value={asset}>{asset}</option>)}
        </select>
        <select aria-label="Filter by operator" value={filters.operator} onChange={update("operator")}>
          <option value="All">All operators</option>
          <option value="Unassigned">Unassigned</option>
          {operators.map((operator) => <option key={operator.id} value={String(operator.id)}>{operator.full_name}</option>)}
        </select>
        {hasActiveFilters && (
          <button className="secondary-button" type="button" onClick={onReset} aria-label="Clear filters" style={{ height: 34 }}>
            <X size={14} /> Clear
          </button>
        )}
      </div>
    </div>
  )
}

/** Ported from prototype: KPI counters + Search, Priority, Asset Code & Operator filters. */
export function FilterBar({ stats, ...controls }) {
  return (
    <>
      <StatsRow stats={stats} />
      <BoardControls {...controls} />
    </>
  )
}
