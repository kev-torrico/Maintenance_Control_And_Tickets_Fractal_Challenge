import logging
from sqlalchemy import func, or_, text
from sqlalchemy.exc import DBAPIError
from app.modules.auth.models.user_model import User, UserBoard
from app.modules.boards.models.asset_code_model import AssetCode
from app.modules.boards.models.list_model import BoardList
from app.modules.tickets.models.ticket_history_model import TicketHistory
from app.modules.tickets.models.ticket_model import Ticket
from app.modules.tickets.utils.serializers import serialize_ticket
from app.modules.tickets.utils.state_machine import (
    RESOLVED,
    has_diagnosis,
    normalize_status,
    status_label,
    validate_transition,
)
from app.shared.exceptions import (
    BadRequestException,
    BusinessRuleException,
    ForbiddenException,
    NotFoundException,
)
from config.database import db
from websockets.board_events import emit_ticket_moved

logger = logging.getLogger(__name__)

# MySQL error code raised by `SIGNAL SQLSTATE '45000'` inside the Stored Procedures.
MYSQL_SIGNAL_ERROR_CODE = 1644

SP_CREATE_TICKET = text(
    "CALL sp_create_ticket(:title, :description, :priority, :asset_code, :list_id, :assigned_to, :created_by)"
)
SP_TRANSITION_TICKET = text(
    "CALL sp_transition_ticket_status(:ticket_id, :target_list_id, :position, :diagnosis, :comment, :changed_by)"
)

class TicketService:
    # ------------------------------------------------------------------ #
    # Queries
    # ------------------------------------------------------------------ #
    @staticmethod
    def list_tickets(filters: dict):
        query = Ticket.query.join(AssetCode, Ticket.asset_code_id == AssetCode.id)

        if filters.get("status"):
            query = query.filter(Ticket.status == filters["status"])
        if filters.get("priority"):
            query = query.filter(Ticket.priority == filters["priority"])
        if filters.get("asset_code"):
            query = query.filter(func.upper(AssetCode.name) == filters["asset_code"].upper())
        if filters.get("assigned_to") is not None:
            query = query.filter(Ticket.assigned_to == filters["assigned_to"])
        if filters.get("search"):
            pattern = f"%{filters['search']}%"
            query = query.filter(
                or_(
                    Ticket.title.ilike(pattern),
                    Ticket.description.ilike(pattern),
                    Ticket.diagnosis.ilike(pattern),
                    AssetCode.name.ilike(pattern),
                )
            )

        return query.order_by(Ticket.created_at.desc(), Ticket.id.desc()).all()

    @staticmethod
    def get_ticket(ticket_id: int) -> Ticket:
        ticket = db.session.get(Ticket, ticket_id, populate_existing=True)
        if ticket is None:
            raise NotFoundException(f"Ticket with id {ticket_id} not found.")
        return ticket

    @staticmethod
    def get_history(ticket_id: int):
        TicketService.get_ticket(ticket_id)
        return (
            TicketHistory.query.filter(TicketHistory.ticket_id == ticket_id)
            .order_by(TicketHistory.created_at.asc(), TicketHistory.id.asc())
            .all()
        )

    @staticmethod
    def get_latest_history(ticket_id: int):
        return (
            TicketHistory.query.filter(TicketHistory.ticket_id == ticket_id)
            .order_by(TicketHistory.created_at.desc(), TicketHistory.id.desc())
            .first()
        )

    # ------------------------------------------------------------------ #
    # Commands
    # ------------------------------------------------------------------ #
    @staticmethod
    def create_ticket(data: dict) -> Ticket:
        target_list = TicketService._get_list(data["list_id"])
        if data.get("assigned_to") is not None:
            TicketService._get_user(data["assigned_to"])

        rows = TicketService._call_procedure(SP_CREATE_TICKET, data)
        if not rows:
            raise RuntimeError("sp_create_ticket did not return the created ticket id.")

        ticket = TicketService.get_ticket(int(rows[0]["ticket_id"]))
        TicketService._emit(
            "ticket_created",
            ticket,
            board_id=target_list.board_id,
            from_list_id=None,
        )
        return ticket

    @staticmethod
    def transition_status(ticket_id: int, data: dict):
        ticket = TicketService.get_ticket(ticket_id)
        target_list = TicketService._get_list(data["target_list_id"])
        current_list = ticket.list

        if current_list is not None and current_list.board_id != target_list.board_id:
            raise BusinessRuleException(
                "Target list belongs to a different board than the ticket.",
                details={"ticket_board_id": current_list.board_id, "target_board_id": target_list.board_id},
            )

        # Only OPERATORs of the board may move tickets (status changes and reordering).
        actor = TicketService._require_operator(data["changed_by_id"], target_list.board_id)

        # Double-defense: Python State Machine before the Stored Procedure.
        validate_transition(
            current_status=ticket.status,
            target_status=target_list.status_key,
            request_diagnosis=data.get("diagnosis"),
            current_diagnosis=ticket.diagnosis,
        )

        position = data.get("position")
        if position is None and target_list.id != ticket.list_id:
            position = TicketService._next_position(target_list.id, exclude_ticket_id=ticket.id)

        from_list_id = ticket.list_id
        previous_status = ticket.status

        comment = data.get("comment")
        if not comment and normalize_status(previous_status) != target_list.status_key:
            # Friendly default (otherwise the SP stores "Status updated to IN_PROGRESS").
            comment = f"Status changed from {status_label(previous_status)} to {status_label(target_list.status_key)}."

        TicketService._call_procedure(
            SP_TRANSITION_TICKET,
            {
                "ticket_id": ticket_id,
                "target_list_id": target_list.id,
                "position": position,
                "diagnosis": data.get("diagnosis"),
                "comment": comment,
                "changed_by": actor.full_name,
            },
        )

        ticket = TicketService.get_ticket(ticket_id)
        latest_history = TicketService.get_latest_history(ticket_id)
        TicketService._emit(
            "ticket_moved",
            ticket,
            board_id=target_list.board_id,
            from_list_id=from_list_id,
            previous_status=previous_status,
        )
        return ticket, latest_history

    @staticmethod
    def update_ticket(ticket_id: int, changes: dict, changed_by: str = None) -> Ticket:
        ticket = TicketService.get_ticket(ticket_id)
        audit_comments = []

        if "assigned_to" in changes and changes["assigned_to"] != ticket.assigned_to:
            new_user = TicketService._get_user(changes["assigned_to"]) if changes["assigned_to"] else None
            old_user = ticket.assigned_user
            if new_user and old_user:
                audit_comments.append(f"Ticket reassigned from {old_user.full_name} to {new_user.full_name}.")
            elif new_user:
                audit_comments.append(f"Ticket assigned to {new_user.full_name}.")
            else:
                previous = old_user.full_name if old_user else f"user {ticket.assigned_to}"
                audit_comments.append(f"Ticket unassigned (previously {previous}).")

        if "diagnosis" in changes and (changes["diagnosis"] or None) != (ticket.diagnosis or None):
            if ticket.status == RESOLVED and not has_diagnosis(changes["diagnosis"]):
                raise BusinessRuleException(
                    "The diagnosis of a resolved ticket cannot be removed.",
                    details={"current_status": ticket.status, "field": "diagnosis"},
                )
            audit_comments.append(
                "Technical diagnosis updated." if changes["diagnosis"] else "Technical diagnosis cleared."
            )

        if audit_comments and not changed_by:
            raise BadRequestException(
                "Field 'changed_by' is required when updating 'assigned_to' or 'diagnosis' (audit trail)."
            )

        for field, value in changes.items():
            setattr(ticket, field, value)

        if audit_comments:
            db.session.add(
                TicketHistory(
                    ticket_id=ticket.id,
                    previous_status=ticket.status,
                    new_status=ticket.status,
                    comment=" ".join(audit_comments)[:250],
                    changed_by=changed_by,
                )
            )

        try:
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise

        ticket = TicketService.get_ticket(ticket_id)
        TicketService._emit(
            "ticket_updated",
            ticket,
            board_id=ticket.list.board_id if ticket.list else None,
            from_list_id=ticket.list_id,
            updated_fields=sorted(changes.keys()),
        )
        return ticket

    # ------------------------------------------------------------------ #
    # Internals
    # ------------------------------------------------------------------ #
    @staticmethod
    def _get_list(list_id: int) -> BoardList:
        board_list = db.session.get(BoardList, list_id)
        if board_list is None:
            raise NotFoundException(f"List with id {list_id} not found.")
        return board_list

    @staticmethod
    def _get_user(user_id: int) -> User:
        user = db.session.get(User, user_id)
        if user is None:
            raise NotFoundException(f"User with id {user_id} not found.")
        return user

    @staticmethod
    def _require_operator(user_id: int, board_id: int) -> User:
        """Return the acting user if they are an OPERATOR of the board, else raise 403."""
        user = TicketService._get_user(user_id)
        membership = UserBoard.query.filter_by(user_id=user.id, board_id=board_id).first()
        if membership is None or membership.role != "OPERATOR":
            role = membership.role if membership else "NONE"
            raise ForbiddenException(
                "Only operators can move tickets between lists or change their status.",
                details={"user_id": user.id, "board_id": board_id, "role": role, "required_role": "OPERATOR"},
            )
        return user

    @staticmethod
    def _next_position(list_id: int, exclude_ticket_id: int = None) -> int:
        query = db.session.query(func.coalesce(func.max(Ticket.position), 0)).filter(Ticket.list_id == list_id)
        if exclude_ticket_id is not None:
            query = query.filter(Ticket.id != exclude_ticket_id)
        return int(query.scalar()) + 1

    @staticmethod
    def _call_procedure(statement, params: dict) -> list:
        """Execute a Stored Procedure atomically, fully consuming the PyMySQL cursor."""
        try:
            result = db.session.execute(statement, params)
            try:
                rows = [dict(row) for row in result.mappings().fetchall()] if result.returns_rows else []
            finally:
                result.close()
            db.session.commit()
            return rows
        except DBAPIError as exc:
            db.session.rollback()
            raise TicketService._translate_db_error(exc) from exc
        except Exception:
            db.session.rollback()
            raise

    @staticmethod
    def _translate_db_error(exc: DBAPIError):
        orig = getattr(exc, "orig", None)
        args = getattr(orig, "args", ()) or ()
        code = args[0] if args else None
        message = str(args[1]) if len(args) > 1 else str(orig or exc)

        if code == MYSQL_SIGNAL_ERROR_CODE:
            lowered = message.lower()
            if "not found" in lowered or "does not exist" in lowered:
                return NotFoundException(message)
            return BusinessRuleException(message)
        return exc

    @staticmethod
    def _emit(action: str, ticket: Ticket, board_id=None, from_list_id=None, **extra) -> None:
        """Broadcast a board-sync event; a socket failure must never break the HTTP request."""
        payload = {
            "action": action,
            "ticket_id": ticket.id,
            "board_id": board_id,
            "from_list_id": from_list_id,
            "to_list_id": ticket.list_id,
            "status": ticket.status,
            "position": ticket.position,
            "ticket": serialize_ticket(ticket),
        }
        payload.update(extra)
        try:
            emit_ticket_moved(payload)
        except Exception:  # pragma: no cover - defensive
            logger.exception("Failed to emit WebSocket event '%s' for ticket %s", action, ticket.id)
