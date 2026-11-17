from app.modules.tickets.models.ticket_model import TICKET_PRIORITIES
from app.modules.tickets.utils.state_machine import TICKET_STATUSES
from app.shared.exceptions import BadRequestException
from app.shared.validators import (
    clean_string,
    parse_enum,
    parse_int,
    require_fields,
    require_json_object,
)

DEFAULT_PENDING_LIST_ID = 1
UPDATABLE_FIELDS = ("title", "description", "priority", "assigned_to", "diagnosis")
FORBIDDEN_UPDATE_FIELDS = ("status", "list_id", "target_list_id", "position")


def validate_ticket_filters(args) -> dict:
    return {
        "status": parse_enum(args.get("status"), "status", TICKET_STATUSES),
        "priority": parse_enum(args.get("priority"), "priority", TICKET_PRIORITIES),
        "asset_code": clean_string(args.get("asset_code"), "asset_code", max_length=100) or None,
        "assigned_to": parse_int(args.get("assigned_to"), "assigned_to", min_value=1),
        "search": clean_string(args.get("search"), "search", max_length=100) or None,
    }


def validate_create_payload(payload) -> dict:
    payload = require_json_object(payload)
    require_fields(payload, ["title", "description", "asset_code", "created_by"])
    return {
        "title": clean_string(payload.get("title"), "title", max_length=100, required=True),
        "description": clean_string(payload.get("description"), "description", max_length=250, required=True),
        "priority": parse_enum(payload.get("priority"), "priority", TICKET_PRIORITIES) or "MEDIUM",
        "asset_code": clean_string(payload.get("asset_code"), "asset_code", max_length=100, required=True).upper(),
        "list_id": parse_int(payload.get("list_id"), "list_id", min_value=1) or DEFAULT_PENDING_LIST_ID,
        "assigned_to": parse_int(payload.get("assigned_to"), "assigned_to", min_value=1),
        "created_by": clean_string(payload.get("created_by"), "created_by", max_length=100, required=True),
    }


def validate_transition_payload(payload) -> dict:
    """`changed_by_id` identifies the acting user (role check: only OPERATORs may move tickets).

    The audit `changed_by` snapshot is taken from that user's `full_name`; a `changed_by`
    string in the payload is accepted for backwards compatibility but not trusted.
    """
    payload = require_json_object(payload)
    require_fields(payload, ["target_list_id", "changed_by_id"])
    return {
        "target_list_id": parse_int(payload.get("target_list_id"), "target_list_id", required=True, min_value=1),
        "position": parse_int(payload.get("position"), "position", min_value=1),
        "diagnosis": clean_string(payload.get("diagnosis"), "diagnosis") or None,
        "comment": clean_string(payload.get("comment"), "comment", max_length=250) or None,
        "changed_by_id": parse_int(payload.get("changed_by_id"), "changed_by_id", required=True, min_value=1),
    }


def validate_update_payload(payload) -> dict:
    """Return only the metadata fields present in the payload, validated.

    `assigned_to` and `diagnosis` may be explicitly set to null to clear them.
    """
    payload = require_json_object(payload)

    forbidden = [f for f in FORBIDDEN_UPDATE_FIELDS if f in payload]
    if forbidden:
        raise BadRequestException(
            f"Field(s) {', '.join(forbidden)} cannot be updated here. "
            "Use PATCH /api/v1/tickets/{ticket_id}/status for status/list/position changes.",
            details={"forbidden_fields": forbidden},
        )

    changes = {}
    if "title" in payload:
        changes["title"] = clean_string(payload["title"], "title", max_length=100, required=True)
    if "description" in payload:
        changes["description"] = clean_string(payload["description"], "description", max_length=250, required=True)
    if "priority" in payload:
        changes["priority"] = parse_enum(payload["priority"], "priority", TICKET_PRIORITIES, required=True)
    if "assigned_to" in payload:
        changes["assigned_to"] = parse_int(payload["assigned_to"], "assigned_to", min_value=1)
    if "diagnosis" in payload:
        changes["diagnosis"] = clean_string(payload["diagnosis"], "diagnosis") or None

    if not changes:
        raise BadRequestException(
            f"No updatable fields provided. Allowed fields: {', '.join(UPDATABLE_FIELDS)}."
        )

    changed_by = clean_string(payload.get("changed_by"), "changed_by", max_length=100)
    return {"changes": changes, "changed_by": changed_by or None}
