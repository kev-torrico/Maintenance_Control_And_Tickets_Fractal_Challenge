import { useCallback, useEffect, useState } from "react"
import { AlertCircle, Lock, RotateCw, ShieldCheck } from "lucide-react"
import { DEFAULT_BOARD_ID } from "@/config/env"
import { useActiveUser } from "@/hooks/useActiveUser"
import { useBoardData } from "@/hooks/useBoardData"
import { getErrorMessage } from "@/services/apiClient"
import {
  evaluateTransition,
  normalizeStatus,
  TICKET_STATUS,
  TRANSITION_MESSAGES,
  TRANSITION_RESULT,
} from "@/utils/stateMachine"
import { formatRelativeTime, getStatusMeta } from "@/utils/formatters"
import { cn } from "@/utils/cn"
import { ToastProvider, useToast } from "@/components/ui/toast"
import { Navbar } from "@/components/layout/Navbar"
import { BoardControls, StatsRow } from "@/components/layout/FilterBar"
import { KanbanBoard } from "@/components/board/KanbanBoard"
import { CreateTicketModal } from "@/components/modals/CreateTicketModal"
import { ResolveTicketModal } from "@/components/modals/ResolveTicketModal"
import { TicketDetailDrawer } from "@/components/modals/TicketDetailDrawer"

/** Re-render periodically so relative timestamps ("Updated 2 min ago") stay fresh. */
function useNow(intervalMs) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}

function Dashboard() {
  const toast = useToast()
  const {
    users,
    operators,
    activeUser,
    activeUserName,
    canMoveTickets,
    selectUser,
    isLoading: isLoadingUsers,
    error: usersError,
    reloadUsers,
  } = useActiveUser()
  const {
    visibleLists,
    stats,
    assetOptions,
    filters,
    setFilters,
    resetFilters,
    hasActiveFilters,
    board,
    isLoading,
    error: boardError,
    lastUpdatedAt,
    isConnected,
    syncVersion,
    pendingTicketIds,
    refresh,
    refreshAll,
    moveTicket,
    findListByStatus,
  } = useBoardData(DEFAULT_BOARD_ID)

  const [createTarget, setCreateTarget] = useState(null) // { list } when open
  const [selectedTicketId, setSelectedTicketId] = useState(null)
  const [resolveRequest, setResolveRequest] = useState(null) // { ticket, targetList, destinationIndex }
  const [localVersion, setLocalVersion] = useState(0)
  const now = useNow(30000)

  const requireActiveUser = useCallback(() => {
    if (activeUserName) return true
    toast.error("Select an active user before changing tickets.")
    return false
  }, [activeUserName, toast])

  /** Single entry point for drag-and-drop, quick actions and drawer buttons. */
  const requestMove = useCallback(
    async ({ ticket, targetList, destinationIndex }) => {
      if (!targetList || !requireActiveUser()) return
      if (!canMoveTickets) {
        toast.error(TRANSITION_MESSAGES.OPERATORS_ONLY) // REPORTERs cannot move tickets (backend: 403)
        return
      }

      const { result, message } = evaluateTransition(ticket.status, targetList.title)

      if (result === TRANSITION_RESULT.BLOCKED) {
        toast.error(message) // card snaps back: board state is untouched
        return
      }
      if (result === TRANSITION_RESULT.REQUIRES_DIAGNOSIS) {
        setSelectedTicketId(null)
        setResolveRequest({ ticket, targetList, destinationIndex })
        return
      }

      try {
        const moved = await moveTicket({
          ticketId: ticket.id,
          targetListId: targetList.id,
          visibleIndex: destinationIndex,
          changedBy: activeUserName,
          changedById: activeUser.id,
        })
        if (moved && result === TRANSITION_RESULT.ALLOWED) {
          toast.success(`Ticket #${ticket.id} moved to ${getStatusMeta(targetList.title).label.toLowerCase()}.`)
        }
        setLocalVersion((v) => v + 1)
      } catch (err) {
        toast.error(getErrorMessage(err)) // optimistic move already reverted (e.g. HTTP 422)
      }
    },
    [activeUser, activeUserName, canMoveTickets, moveTicket, requireActiveUser, toast],
  )

  const handleTicketDrop = useCallback(
    ({ ticket, targetList, destinationIndex }) => requestMove({ ticket, targetList, destinationIndex }),
    [requestMove],
  )

  const requestStatusChange = useCallback(
    (ticket, targetStatus) => requestMove({ ticket, targetList: findListByStatus(targetStatus) }),
    [findListByStatus, requestMove],
  )

  const handleQuickAction = useCallback(
    (ticket) => {
      if (ticket.status === TICKET_STATUS.PENDING) requestStatusChange(ticket, TICKET_STATUS.IN_PROGRESS)
      else if (ticket.status === TICKET_STATUS.IN_PROGRESS) requestStatusChange(ticket, TICKET_STATUS.RESOLVED)
      else toast.error("Closed tickets cannot be reopened directly.")
    },
    [requestStatusChange, toast],
  )

  const handleOpenTicket = useCallback((ticket) => setSelectedTicketId(ticket.id), [])

  const handleAddTicket = useCallback(
    (list) => {
      if (!requireActiveUser()) return
      setCreateTarget({ list: list || findListByStatus(TICKET_STATUS.PENDING) })
    },
    [findListByStatus, requireActiveUser],
  )

  async function handleConfirmResolve({ diagnosis, comment }) {
    const { ticket, targetList, destinationIndex } = resolveRequest
    try {
      await moveTicket({
        ticketId: ticket.id,
        targetListId: targetList.id,
        visibleIndex: destinationIndex,
        diagnosis,
        comment,
        changedBy: activeUserName,
        changedById: activeUser.id,
      })
    } catch (err) {
      toast.error(getErrorMessage(err))
      throw err // keeps the modal open with the backend message inline
    }
    setResolveRequest(null)
    setLocalVersion((v) => v + 1)
    toast.success(`Ticket #${ticket.id} marked as resolved.`)
  }

  function handleTicketCreated(ticket) {
    setCreateTarget(null)
    toast.success(`Ticket #${ticket.id} created successfully.`)
    refreshAll()
  }

  const isLive = isConnected && !boardError
  const pageError = boardError || usersError

  return (
    <main className="app-shell">
      <Navbar
        users={users}
        activeUser={activeUser}
        onUserChange={selectUser}
        onNewTicket={() => handleAddTicket(null)}
        isConnected={isConnected}
        isLoadingUsers={isLoadingUsers}
      />

      <section className="page-content">
        <div className="page-heading">
          <div>
            <div className="eyebrow">
              <span className={cn("live-dot", !isLive && "offline")} /> OPERATIONS OVERVIEW <span className="eyebrow-divider">/</span> INFRASTRUCTURE
            </div>
            <h1>Maintenance tickets</h1>
            <p className="heading-copy">Track, assign, and resolve infrastructure issues across your locations.</p>
          </div>
          <div className="updated-label" aria-live="polite">
            <span className={cn("live-dot", !isLive && "offline")} />
            {isConnected ? "Live board" : "Reconnecting…"}
            <span className="updated-divider">·</span>
            {lastUpdatedAt ? `Updated ${formatRelativeTime(lastUpdatedAt, now)}` : "Loading…"}
          </div>
        </div>

        {pageError && (
          <div className="board-banner">
            <div className="validation-error" role="alert"><AlertCircle size={15} />{pageError}</div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                refresh()
                if (usersError) reloadUsers()
              }}
            >
              <RotateCw size={13} /> Retry
            </button>
          </div>
        )}

        <StatsRow stats={stats} />

        <section className="board-section">
          <BoardControls
            filters={filters}
            onChange={setFilters}
            onReset={resetFilters}
            hasActiveFilters={hasActiveFilters}
            assetOptions={assetOptions}
            operators={operators}
          />
          {activeUser && !canMoveTickets && (
            <div className="role-note" role="note">
              <Lock size={14} />
              You are viewing the board as a reporter: you can create and review tickets, but only operators can move them.
            </div>
          )}
          <KanbanBoard
            lists={visibleLists}
            isLoading={isLoading && !board}
            hasActiveFilters={hasActiveFilters}
            pendingTicketIds={pendingTicketIds}
            canMoveTickets={canMoveTickets}
            onTicketDrop={handleTicketDrop}
            onOpenTicket={handleOpenTicket}
            onQuickAction={handleQuickAction}
            onAddTicket={handleAddTicket}
          />
        </section>

        <footer className="page-footer">
          <span><ShieldCheck size={14} /> Infrastructure operations</span>
          <span>Secure workspace <span className="footer-dot">·</span> All activity is logged</span>
        </footer>
      </section>

      {createTarget && (
        <CreateTicketModal
          targetList={createTarget.list}
          assetOptions={assetOptions}
          operators={operators}
          activeUserName={activeUserName}
          onClose={() => setCreateTarget(null)}
          onCreated={handleTicketCreated}
        />
      )}

      {resolveRequest && (
        <ResolveTicketModal
          ticket={resolveRequest.ticket}
          activeUserName={activeUserName}
          onCancel={() => setResolveRequest(null)}
          onConfirm={handleConfirmResolve}
        />
      )}

      {selectedTicketId !== null && (
        <TicketDetailDrawer
          ticketId={selectedTicketId}
          syncVersion={syncVersion + localVersion}
          operators={operators}
          activeUserName={activeUserName}
          canMoveTickets={canMoveTickets}
          isTransitionPending={pendingTicketIds.has(selectedTicketId)}
          onClose={() => setSelectedTicketId(null)}
          onTransition={(ticket, status) => {
            if (normalizeStatus(status) === TICKET_STATUS.RESOLVED) return
            requestStatusChange(ticket, status)
          }}
          onResolve={(ticket) => requestStatusChange(ticket, TICKET_STATUS.RESOLVED)}
          onChanged={() => refresh({ silent: true })}
          toast={toast}
        />
      )}
    </main>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <Dashboard />
    </ToastProvider>
  )
}
