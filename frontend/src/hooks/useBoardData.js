import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { boardService } from "@/services/boardService";
import { ticketService } from "@/services/ticketService";
import { getErrorMessage } from "@/services/apiClient";
import { onConnectionChange, onTicketUpdated } from "@/services/socketService";
import { normalizeStatus } from "@/utils/stateMachine";

const SOCKET_REFRESH_DEBOUNCE_MS = 250;

export const EMPTY_FILTERS = Object.freeze({
  search: "",
  priority: "All",
  assetCode: "All",
  operator: "All", // "All" | "Unassigned" | "<user id>"
});

/** Client-side board filtering (search, priority, asset code and operator). */
export function matchesFilters(ticket, filters) {
  const query = filters.search.trim().toLowerCase();
  if (query) {
    const haystack =
      `${ticket.title} ${ticket.description || ""} ${ticket.asset_code?.name || ""} #${ticket.id}`.toLowerCase();
    if (!haystack.includes(query)) return false;
  }
  if (filters.priority !== "All" && ticket.priority !== filters.priority)
    return false;
  if (
    filters.assetCode !== "All" &&
    ticket.asset_code?.name !== filters.assetCode
  )
    return false;
  if (filters.operator === "Unassigned" && ticket.assigned_to != null)
    return false;
  if (
    filters.operator !== "All" &&
    filters.operator !== "Unassigned" &&
    String(ticket.assigned_to) !== String(filters.operator)
  ) {
    return false;
  }
  return true;
}

/**
 * Compute the new ordering of the destination list.
 * `visibleIndex` is the drop index inside the *filtered* column, so hidden tickets keep their place.
 */
function planMove(lists, ticket, targetListId, visibleIndex, filters) {
  const target = lists.find((list) => list.id === targetListId);
  const remaining = target.tickets.filter((t) => t.id !== ticket.id);
  const visibleRemaining = remaining.filter((t) => matchesFilters(t, filters));

  let insertAt = remaining.length;
  if (visibleIndex != null && visibleIndex < visibleRemaining.length) {
    insertAt = remaining.findIndex(
      (t) => t.id === visibleRemaining[visibleIndex].id,
    );
  } else if (visibleRemaining.length) {
    insertAt =
      remaining.findIndex(
        (t) => t.id === visibleRemaining[visibleRemaining.length - 1].id,
      ) + 1;
  }

  const movedTicket = {
    ...ticket,
    list_id: target.id,
    status: normalizeStatus(target.title),
  };
  const ordered = [
    ...remaining.slice(0, insertAt),
    movedTicket,
    ...remaining.slice(insertAt),
  ];
  const renumbered = ordered.map((t, index) => ({ ...t, position: index + 1 }));

  // Siblings whose stored position must shift to keep a strict order (no SP-level reindexing exists).
  const previousPositions = new Map(
    target.tickets.map((t) => [t.id, t.position]),
  );
  const siblingUpdates = renumbered.filter(
    (t) => t.id !== ticket.id && previousPositions.get(t.id) !== t.position,
  );

  return { target, renumbered, position: insertAt + 1, siblingUpdates };
}

/**
 * Board state for the Kanban view:
 * - loads GET /boards/:id and GET /boards/assets
 * - client-side filters
 * - optimistic moves with rollback on API errors (e.g. HTTP 422)
 * - real-time refresh on Socket.IO `ticket_updated` events
 */
export function useBoardData(boardId) {
  const [board, setBoard] = useState(null);
  const [assets, setAssets] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [syncVersion, setSyncVersion] = useState(0);
  const [pendingTicketIds, setPendingTicketIds] = useState(() => new Set());

  const requestSeq = useRef(0);
  const mutationsInFlight = useRef(0);
  const refreshDeferred = useRef(false);
  const debounceTimer = useRef(null);
  const boardRef = useRef(null);
  boardRef.current = board;

  const loadAssets = useCallback(async () => {
    try {
      setAssets(await boardService.getAssets());
    } catch {
      /* non-blocking: filters fall back to assets present on the board */
    }
  }, []);

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (mutationsInFlight.current > 0) {
        refreshDeferred.current = true;
        return;
      }
      const seq = ++requestSeq.current;
      if (!silent) setIsLoading(true);
      try {
        const data = await boardService.getBoard(boardId);
        if (seq !== requestSeq.current) return;
        setBoard(data);
        setError(null);
        setLastUpdatedAt(new Date());
      } catch (err) {
        if (seq !== requestSeq.current) return;
        setError(getErrorMessage(err));
      } finally {
        if (seq === requestSeq.current) setIsLoading(false);
      }
    },
    [boardId],
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([refresh({ silent: true }), loadAssets()]);
  }, [refresh, loadAssets]);

  // Initial load
  useEffect(() => {
    refresh();
    loadAssets();
  }, [refresh, loadAssets]);

  // Real-time sync
  useEffect(() => {
    const unsubscribeStatus = onConnectionChange((connected) => {
      setIsConnected(connected);
    });
    const unsubscribeUpdates = onTicketUpdated((payload) => {
      if (
        payload?.board_id != null &&
        Number(payload.board_id) !== Number(boardId)
      )
        return;
      window.clearTimeout(debounceTimer.current);
      debounceTimer.current = window.setTimeout(() => {
        refresh({ silent: true });
        if (payload?.action === "ticket_created") loadAssets();
        setSyncVersion((v) => v + 1);
      }, SOCKET_REFRESH_DEBOUNCE_MS);
    });
    return () => {
      window.clearTimeout(debounceTimer.current);
      unsubscribeStatus();
      unsubscribeUpdates();
    };
  }, [boardId, refresh, loadAssets]);

  const beginMutation = (ticketId) => {
    mutationsInFlight.current += 1;
    setPendingTicketIds((prev) => new Set(prev).add(ticketId));
  };

  const endMutation = (ticketId) => {
    mutationsInFlight.current = Math.max(0, mutationsInFlight.current - 1);
    setPendingTicketIds((prev) => {
      const next = new Set(prev);
      next.delete(ticketId);
      return next;
    });
    if (mutationsInFlight.current === 0 && refreshDeferred.current) {
      refreshDeferred.current = false;
      refresh({ silent: true });
    }
  };

  /**
   * Optimistically move a ticket and persist it through PATCH /tickets/:id/status.
   * Reverts the board and rethrows the ApiError when the backend rejects it (400/404/422/500).
   */
  const moveTicket = useCallback(
    async ({
      ticketId,
      targetListId,
      visibleIndex,
      diagnosis,
      comment,
      changedBy,
      changedById,
    }) => {
      const snapshot = boardRef.current;
      if (!snapshot) return null;
      const sourceList = snapshot.lists.find((list) =>
        list.tickets.some((t) => t.id === ticketId),
      );
      const ticket = sourceList?.tickets.find((t) => t.id === ticketId);
      if (!ticket) return null;

      const plan = planMove(
        snapshot.lists,
        ticket,
        targetListId,
        visibleIndex,
        filters,
      );
      if (
        sourceList.id === targetListId &&
        ticket.position === plan.position &&
        plan.siblingUpdates.length === 0
      ) {
        return null; // dropped where it was
      }

      // Optimistic UI update
      setBoard({
        ...snapshot,
        lists: snapshot.lists.map((list) => {
          if (list.id === plan.target.id)
            return {
              ...list,
              tickets: plan.renumbered,
              ticket_count: plan.renumbered.length,
            };
          if (list.id === sourceList.id) {
            const tickets = list.tickets.filter((t) => t.id !== ticketId);
            return { ...list, tickets, ticket_count: tickets.length };
          }
          return list;
        }),
      });

      beginMutation(ticketId);
      try {
        const result = await ticketService.transitionStatus(ticketId, {
          targetListId,
          position: plan.position,
          diagnosis,
          comment,
          changedBy,
          changedById,
        });
        // Keep a strict order inside the destination list (same-list reorders, no audit entry).
        await Promise.allSettled(
          plan.siblingUpdates.map((sibling) =>
            ticketService.transitionStatus(sibling.id, {
              targetListId,
              position: sibling.position,
              changedBy,
              changedById,
            }),
          ),
        );
        return result;
      } catch (err) {
        setBoard(snapshot); // revert the optimistic card position
        throw err;
      } finally {
        // Reconcile with the server once every in-flight move has settled.
        refreshDeferred.current = true;
        endMutation(ticketId);
      }
    },
    [filters, refresh],
  );

  const lists = useMemo(() => board?.lists || [], [board]);

  const visibleLists = useMemo(
    () =>
      lists.map((list) => ({
        ...list,
        tickets: list.tickets.filter((t) => matchesFilters(t, filters)),
      })),
    [lists, filters],
  );

  const stats = useMemo(() => {
    const counts = { PENDING: 0, IN_PROGRESS: 0, RESOLVED: 0 };
    let total = 0;
    lists.forEach((list) => {
      list.tickets.forEach((ticket) => {
        counts[ticket.status] = (counts[ticket.status] || 0) + 1;
        total += 1;
      });
    });
    return { ...counts, total };
  }, [lists]);

  const assetOptions = useMemo(() => {
    const names = new Set(assets.map((asset) => asset.name));
    lists.forEach((list) =>
      list.tickets.forEach(
        (t) => t.asset_code?.name && names.add(t.asset_code.name),
      ),
    );
    return [...names].sort();
  }, [assets, lists]);

  const findListByStatus = useCallback(
    (status) =>
      lists.find(
        (list) => normalizeStatus(list.title) === normalizeStatus(status),
      ) || null,
    [lists],
  );

  const findTicket = useCallback(
    (ticketId) => {
      for (const list of lists) {
        const ticket = list.tickets.find((t) => t.id === ticketId);
        if (ticket) return { ticket, list };
      }
      return null;
    },
    [lists],
  );

  const hasActiveFilters =
    filters.search.trim() !== "" ||
    filters.priority !== EMPTY_FILTERS.priority ||
    filters.assetCode !== EMPTY_FILTERS.assetCode ||
    filters.operator !== EMPTY_FILTERS.operator;

  return {
    board,
    lists,
    visibleLists,
    stats,
    assets,
    assetOptions,
    filters,
    setFilters,
    resetFilters: () => setFilters(EMPTY_FILTERS),
    hasActiveFilters,
    isLoading,
    error,
    lastUpdatedAt,
    isConnected,
    syncVersion,
    pendingTicketIds,
    refresh,
    refreshAll,
    moveTicket,
    findListByStatus,
    findTicket,
  };
}
