from app.modules.tickets.utils.serializers import serialize_asset_code, serialize_ticket
from app.shared.validators import isoformat

def serialize_board_summary(board):
    return {
        "id": board.id,
        "title": board.title,
        "status": board.status,
        "created_at": isoformat(board.created_at),
    }

def serialize_board_list(board_list, include_tickets: bool = True):
    data = {
        "id": board_list.id,
        "title": board_list.title,
        "board_id": board_list.board_id,
        "position": board_list.position,
        "created_at": isoformat(board_list.created_at),
    }
    if include_tickets:
        tickets = [serialize_ticket(t, include_list=False) for t in board_list.tickets]
        data["tickets"] = tickets
        data["ticket_count"] = len(tickets)
    return data

def serialize_board_detail(board):
    data = serialize_board_summary(board)
    data["lists"] = [serialize_board_list(bl) for bl in board.lists]
    return data

def serialize_asset(asset_code):
    return serialize_asset_code(asset_code)