import { useCallback, useEffect, useMemo, useState } from "react"
import { DEFAULT_BOARD_ID } from "@/config/env"
import { authService } from "@/services/authService"
import { getErrorMessage } from "@/services/apiClient"
import { canMoveTickets } from "@/utils/stateMachine"

const STORAGE_KEY = "maintenance-tickets.active-user-id"

function readStoredUserId() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value ? Number(value) : null
  } catch {
    return null
  }
}

function storeUserId(userId) {
  try {
    if (userId) window.localStorage.setItem(STORAGE_KEY, String(userId))
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable (private mode) — the switcher still works in memory */
  }
}

/**
 * Loads users from GET /auth/users and manages the active user switcher.
 * The active user's `full_name` is sent as `created_by` / `changed_by`.
 */
export function useActiveUser() {
  const [users, setUsers] = useState([])
  const [activeUserId, setActiveUserId] = useState(readStoredUserId)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadUsers = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await authService.getUsers()
      setUsers(data)
      setError(null)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const activeUser = useMemo(() => {
    if (!users.length) return null
    return users.find((user) => user.id === activeUserId) || users[0]
  }, [users, activeUserId])

  useEffect(() => {
    if (activeUser) storeUserId(activeUser.id)
  }, [activeUser])

  const selectUser = useCallback((userId) => {
    setActiveUserId(Number(userId) || null)
  }, [])

  const operators = useMemo(() => users.filter((user) => user.role === "OPERATOR"), [users])

  // Role on the board being displayed (falls back to the user's primary role).
  const activeRole = useMemo(() => {
    if (!activeUser) return null
    const membership = activeUser.boards?.find((board) => board.board_id === DEFAULT_BOARD_ID)
    return membership?.role || activeUser.role || null
  }, [activeUser])

  return {
    users,
    operators,
    activeUser,
    activeRole,
    canMoveTickets: canMoveTickets(activeRole),
    activeUserName: activeUser?.full_name || "",
    selectUser,
    reloadUsers: loadUsers,
    isLoading,
    error,
  }
}
