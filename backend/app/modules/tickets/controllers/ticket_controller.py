from flask import request
from app.modules.tickets.services.ticket_service import TicketService
from app.modules.tickets.utils.serializers import (
    serialize_history_entry,
    serialize_ticket,
    serialize_transition_result,
)
from app.modules.tickets.utils.validators import (
    validate_create_payload,
    validate_ticket_filters,
    validate_transition_payload,
    validate_update_payload,
)
from app.shared.responses import success_response
from app.shared.validators import get_json_body

class TicketController:
    @staticmethod
    def list_tickets():
        filters = validate_ticket_filters(request.args)
        tickets = TicketService.list_tickets(filters)
        data = [serialize_ticket(t) for t in tickets]
        applied = {k: v for k, v in filters.items() if v is not None}
        return success_response(data, "Tickets retrieved successfully.", count=len(data), filters=applied)

    @staticmethod
    def get_ticket(ticket_id: int):
        ticket = TicketService.get_ticket(ticket_id)
        return success_response(
            serialize_ticket(ticket, include_history=True), "Ticket retrieved successfully."
        )

    @staticmethod
    def create_ticket():
        data = validate_create_payload(get_json_body(request))
        ticket = TicketService.create_ticket(data)
        return success_response(
            serialize_ticket(ticket, include_history=True), "Ticket created successfully.", 201
        )

    @staticmethod
    def transition_status(ticket_id: int):
        data = validate_transition_payload(get_json_body(request))
        ticket, latest_history = TicketService.transition_status(ticket_id, data)
        return success_response(
            serialize_transition_result(ticket, latest_history), "Ticket status updated successfully."
        )

    @staticmethod
    def update_ticket(ticket_id: int):
        data = validate_update_payload(get_json_body(request))
        ticket = TicketService.update_ticket(ticket_id, data["changes"], data["changed_by"])
        return success_response(
            serialize_ticket(ticket, include_history=True), "Ticket updated successfully."
        )

    @staticmethod
    def get_history(ticket_id: int):
        history = TicketService.get_history(ticket_id)
        data = [serialize_history_entry(h) for h in history]
        return success_response(data, "Ticket history retrieved successfully.", count=len(data))