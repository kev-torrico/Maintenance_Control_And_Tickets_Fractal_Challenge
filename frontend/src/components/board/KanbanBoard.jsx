import { useCallback, useState } from "react"
import { DragDropContext } from "@hello-pangea/dnd"
import { KanbanColumn } from "@/components/board/KanbanColumn"
import { evaluateTransition, normalizeStatus, TICKET_STATUS, TRANSITION_RESULT } from "@/utils/stateMachine"

const parseId = (value, prefix) => Number(String(value).replace(prefix, ""))

/**
 * Drag-and-Drop context (@hello-pangea/dnd: mouse, touch and keyboard accessible).
 * Delegates every drop to `onTicketDrop`, which enforces the State Machine.
 */
export function KanbanBoard({
  lists,
  isLoading,
  hasActiveFilters,
  pendingTicketIds,
  canMoveTickets = true,
  onTicketDrop,
  onOpenTicket,
  onQuickAction,
  onAddTicket,
}) {
  const [dragSourceStatus, setDragSourceStatus] = useState(null)

  const findList = useCallback((droppableId) => lists.find((list) => list.id === parseId(droppableId, "list-")), [lists])

  const handleDragStart = useCallback(
    (start) => {
      setDragSourceStatus(normalizeStatus(findList(start.source.droppableId)?.title))
    },
    [findList],
  )

  const handleDragEnd = useCallback(
    (result) => {
      setDragSourceStatus(null)
      const { source, destination, draggableId } = result
      if (!destination) return
      if (source.droppableId === destination.droppableId && source.index === destination.index) return

      const sourceList = findList(source.droppableId)
      const targetList = findList(destination.droppableId)
      const ticketId = parseId(draggableId, "ticket-")
      const ticket = sourceList?.tickets.find((t) => t.id === ticketId)
      if (!sourceList || !targetList || !ticket) return

      onTicketDrop({ ticket, sourceList, targetList, destinationIndex: destination.index })
    },
    [findList, onTicketDrop],
  )

  return (
    <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="kanban">
        {lists.map((list) => {
          const status = normalizeStatus(list.title)
          const isInvalidTarget =
            dragSourceStatus !== null &&
            evaluateTransition(dragSourceStatus, status).result === TRANSITION_RESULT.BLOCKED
          return (
            <KanbanColumn
              key={list.id}
              list={list}
              status={status}
              isInvalidTarget={isInvalidTarget}
              isLoading={isLoading}
              hasActiveFilters={hasActiveFilters}
              pendingTicketIds={pendingTicketIds}
              canMoveTickets={canMoveTickets}
              onOpenTicket={onOpenTicket}
              onQuickAction={onQuickAction}
              onAddTicket={status === TICKET_STATUS.RESOLVED ? null : onAddTicket}
            />
          )
        })}
      </div>
    </DragDropContext>
  )
}
