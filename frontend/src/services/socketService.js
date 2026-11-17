import { io } from "socket.io-client"
import { SOCKET_URL } from "@/config/env"

export const TICKET_UPDATED_EVENT = "ticket_updated"

let socket = null

/** Lazily create a single shared Socket.IO connection. */
export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    })
  }
  return socket
}

/**
 * Subscribe to backend `ticket_updated` events (websockets/board_events.py).
 * @returns {() => void} unsubscribe
 */
export function onTicketUpdated(handler) {
  const client = getSocket()
  client.on(TICKET_UPDATED_EVENT, handler)
  return () => client.off(TICKET_UPDATED_EVENT, handler)
}

/**
 * Track connection status changes.
 * @returns {() => void} unsubscribe
 */
export function onConnectionChange(handler) {
  const client = getSocket()
  const handleConnect = () => handler(true)
  const handleDisconnect = () => handler(false)
  client.on("connect", handleConnect)
  client.on("disconnect", handleDisconnect)
  client.on("connect_error", handleDisconnect)
  handler(client.connected)
  return () => {
    client.off("connect", handleConnect)
    client.off("disconnect", handleDisconnect)
    client.off("connect_error", handleDisconnect)
  }
}

export const socketService = { getSocket, onTicketUpdated, onConnectionChange }
