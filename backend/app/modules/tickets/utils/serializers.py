from app.shared.validators import isoformat

def serialize_asset_code(asset_code):
    if asset_code is None:
        return None
    return {"id": asset_code.id, "name": asset_code.name}

def serialize_assigned_user(user):
    if user is None:
        return None
    return {"id": user.id, "full_name": user.full_name}

def serialize_list_summary(board_list):
    if board_list is None:
        return None
    return {
        "id": board_list.id,
        "title": board_list.title,
        "board_id": board_list.board_id,
        "position": board_list.position,
    }

def serialize_history_entry(entry):
    return {
        "id": entry.id,
        "ticket_id": entry.ticket_id,
        "previous_status": entry.previous_status,
        "new_status": entry.new_status,
        "comment": entry.comment,
        "changed_by": entry.changed_by,
        "created_at": isoformat(entry.created_at),
    }

def serialize_ticket(ticket, include_list: bool = True, include_history: bool = False):
    data = {
        "id": ticket.id,
        "title": ticket.title,
        "description": ticket.description,
        "position": ticket.position,
        "priority": ticket.priority,
        "status": ticket.status,
        "diagnosis": ticket.diagnosis,
        "assigned_to": ticket.assigned_to,
        "assigned_user": serialize_assigned_user(ticket.assigned_user),
        "asset_code_id": ticket.asset_code_id,
        "asset_code": serialize_asset_code(ticket.asset_code),
        "list_id": ticket.list_id,
        "created_at": isoformat(ticket.created_at),
        "updated_at": isoformat(ticket.updated_at),
    }
    if include_list:
        data["list"] = serialize_list_summary(ticket.list)
    if include_history:
        data["history"] = [serialize_history_entry(entry) for entry in ticket.history]
    return data

def serialize_transition_result(ticket, latest_history) -> dict:
    data = serialize_ticket(ticket)
    data["latest_history"] = serialize_history_entry(latest_history) if latest_history else None
    return data