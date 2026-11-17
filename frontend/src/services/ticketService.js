import { apiClient } from "@/services/apiClient";

export const ticketService = {
  /** GET /tickets — filters: status, priority, asset_code, assigned_to, search. */
  async getTickets(filters = {}) {
    const { data } = await apiClient.get("/tickets", { params: filters });
    return data;
  },

  /** GET /tickets/:id — detail including asset_code, assigned_user, list and history. */
  async getTicket(ticketId, options) {
    const { data } = await apiClient.get(`/tickets/${ticketId}`, options);
    return data;
  },

  /** POST /tickets — executes sp_create_ticket. */
  async createTicket({
    title,
    description,
    priority,
    assetCode,
    listId,
    assignedTo,
    createdBy,
  }) {
    const { data } = await apiClient.post("/tickets", {
      title,
      description,
      priority,
      asset_code: assetCode,
      list_id: listId ?? undefined,
      assigned_to: assignedTo ?? null,
      created_by: createdBy,
    });
    return data;
  },

  /**
   * PATCH /tickets/:id/status — executes sp_transition_ticket_status.
   */
  async transitionStatus(
    ticketId,
    { targetListId, position, diagnosis, comment, changedById, changedBy },
  ) {
    const { data } = await apiClient.patch(`/tickets/${ticketId}/status`, {
      target_list_id: targetListId,
      position: position ?? undefined,
      diagnosis: diagnosis ?? null,
      comment: comment ?? null,
      changed_by_id: changedById,
      changed_by: changedBy,
    });
    return data;
  },

  /** PATCH /tickets/:id — title, description, priority, assigned_to, diagnosis. */
  async updateTicket(ticketId, changes, changedBy) {
    const { data } = await apiClient.patch(`/tickets/${ticketId}`, {
      ...changes,
      changed_by: changedBy,
    });
    return data;
  },

  /** GET /tickets/:id/history — chronological audit trail. */
  async getHistory(ticketId) {
    const { data } = await apiClient.get(`/tickets/${ticketId}/history`);
    return data;
  },
};
