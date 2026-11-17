from flask import Blueprint
from app.modules.tickets.controllers.ticket_controller import TicketController

ticket_bp = Blueprint("tickets", __name__)

@ticket_bp.get("", strict_slashes=False)
def list_tickets():
    """List tickets. Filters: status, priority, asset_code, assigned_to, search.

    OpenAPI: operationId `listTickets`.
    """
    return TicketController.list_tickets()

@ticket_bp.post("", strict_slashes=False)
def create_ticket():
    """Create a ticket through `sp_create_ticket`. 201 Created.

    OpenAPI: operationId `createTicket`.
    """
    return TicketController.create_ticket()

@ticket_bp.get("/<int:ticket_id>")
def get_ticket(ticket_id: int):
    """Ticket detail with asset code, assigned user, list and chronological history.

    OpenAPI: operationId `getTicket`.
    """
    return TicketController.get_ticket(ticket_id)

@ticket_bp.patch("/<int:ticket_id>")
def update_ticket(ticket_id: int):
    """Update non-status metadata (title, description, priority, assigned_to, diagnosis).

    OpenAPI: operationId `updateTicket`.
    """
    return TicketController.update_ticket(ticket_id)

@ticket_bp.patch("/<int:ticket_id>/status")
def transition_status(ticket_id: int):
    """Move a ticket between lists via `sp_transition_ticket_status` (State Machine enforced, 422 on violation).

    OpenAPI: operationId `transitionTicketStatus`.
    """
    return TicketController.transition_status(ticket_id)

@ticket_bp.get("/<int:ticket_id>/history")
def get_history(ticket_id: int):
    """Chronological audit trail of a ticket.

    OpenAPI: operationId `getTicketHistory`.
    """
    return TicketController.get_history(ticket_id)