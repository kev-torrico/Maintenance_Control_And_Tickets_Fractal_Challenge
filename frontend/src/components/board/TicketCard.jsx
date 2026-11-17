import { memo } from "react"
import { Draggable } from "@hello-pangea/dnd"
import { ArrowRight, Check, History, Loader2 } from "lucide-react"
import { cn } from "@/utils/cn"
import { formatRelativeTime, formatShortDate, formatStatus, initials, priorityClass } from "@/utils/formatters"
import { TICKET_STATUS, TRANSITION_MESSAGES } from "@/utils/stateMachine"

function QuickActionContent({ status, isPending }) {
  if (isPending) return <Loader2 size={14} className="spin" />
  if (status === TICKET_STATUS.PENDING) return <><span>Start work</span><ArrowRight size={14} /></>
  if (status === TICKET_STATUS.IN_PROGRESS) return <><span>Resolve</span><Check size={14} /></>
  return <Check size={15} />
}

/** Draggable ticket card styled with the prototype `.ticket-card` classes. */
function TicketCardComponent({ ticket, index, onOpen, onQuickAction, isPending, canMove = true }) {
  const assignedName = ticket.assigned_user?.full_name || "Unassigned"
  const isResolved = ticket.status === TICKET_STATUS.RESOLVED
  const dragHint = canMove ? "Press space to drag, enter to open." : "Press enter to open."

  return (
    <Draggable draggableId={`ticket-${ticket.id}`} index={index} isDragDisabled={isPending || !canMove}>
      {(provided, snapshot) => (
        <article
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn("ticket-card", snapshot.isDragging && "is-dragging", isPending && "is-pending")}
          onClick={() => onOpen(ticket)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onOpen(ticket)
          }}
          tabIndex={0}
          aria-label={`Ticket #${ticket.id}: ${ticket.title}. Status ${formatStatus(ticket.status)}. ${dragHint}`}
          aria-busy={isPending || undefined}
        >
          <div className="card-top">
            <span className="ticket-id">#{ticket.id}</span>
            <span className="asset-pill"><span className="asset-indicator" />{ticket.asset_code?.name || "—"}</span>
            <span className={`priority-badge ${priorityClass(ticket.priority)}`}><span />{ticket.priority}</span>
          </div>
          <h4>{ticket.title}</h4>
          <p className="ticket-description">{ticket.description}</p>
          <div className="card-meta">
            <span className={cn("operator-avatar", !ticket.assigned_user && "unassigned")}>{initials(assignedName)}</span>
            <span className="assigned-name">{assignedName}</span>
            <span className="card-meta-spacer" />
            <button
              className="quick-action"
              type="button"
              aria-label={isResolved ? "Ticket is resolved" : canMove ? `Advance ticket ${ticket.id}` : TRANSITION_MESSAGES.OPERATORS_ONLY}
              title={!isResolved && !canMove ? TRANSITION_MESSAGES.OPERATORS_ONLY : undefined}
              disabled={isResolved || isPending || !canMove}
              onClick={(event) => {
                event.stopPropagation()
                onQuickAction(ticket)
              }}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <QuickActionContent status={ticket.status} isPending={isPending} />
            </button>
          </div>
          <div className="card-bottom">
            <span title={`Last updated ${formatRelativeTime(ticket.updated_at)}`}>
              <History size={12} />Updated {formatRelativeTime(ticket.updated_at)}
            </span>
            <span className="card-date" title="Created">{formatShortDate(ticket.created_at)}</span>
          </div>
        </article>
      )}
    </Draggable>
  )
}

export const TicketCard = memo(TicketCardComponent)
