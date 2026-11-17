import { Droppable } from "@hello-pangea/dnd"
import { Filter, Inbox, Loader2 } from "lucide-react"
import { cn } from "@/utils/cn"
import { getStatusMeta } from "@/utils/formatters"
import { TicketCard } from "@/components/board/TicketCard"

/** Droppable list column styled with the prototype `.kanban-column` classes. */
export function KanbanColumn({
  list,
  status,
  isInvalidTarget,
  isLoading,
  hasActiveFilters,
  pendingTicketIds,
  canMoveTickets,
  onOpenTicket,
  onQuickAction,
  onAddTicket,
}) {
  const { label, tone, icon: Icon } = getStatusMeta(status)
  const tickets = list.tickets

  return (
    <section className={cn("kanban-column", isInvalidTarget && "is-locked")} aria-label={`${label} tickets`}>
      <div className="column-head">
        <div className="column-name">
          <span className={`status-icon ${tone}`}><Icon size={14} /></span>
          <h3>{label}</h3>
          <span className={`count-badge ${tone}`}>{tickets.length}</span>
        </div>
        <button className="more-button" type="button" aria-label={`More ${label} actions`}>···</button>
      </div>
      <Droppable droppableId={`list-${list.id}`} isDropDisabled={!canMoveTickets}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn("column-cards dnd-cards", snapshot.isDraggingOver && "is-drop-target")}
          >
            {tickets.map((ticket, index) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                index={index}
                isPending={pendingTicketIds.has(ticket.id)}
                canMove={canMoveTickets}
                onOpen={onOpenTicket}
                onQuickAction={onQuickAction}
              />
            ))}
            {provided.placeholder}
            {tickets.length === 0 && !snapshot.isDraggingOver && (
              <div className="empty-column">
                {isLoading ? <Loader2 size={18} className="spin" /> : hasActiveFilters ? <Filter size={18} /> : <Inbox size={18} />}
                <span>{isLoading ? "Loading tickets…" : hasActiveFilters ? "No tickets match" : "No tickets yet"}</span>
              </div>
            )}
          </div>
        )}
      </Droppable>
      {onAddTicket && (
        <button className="add-ticket-link" type="button" onClick={() => onAddTicket(list)}>+ Add ticket</button>
      )}
    </section>
  )
}
