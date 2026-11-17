import re
from app.modules.auth.models.user_model import USER_ROLES
from app.shared.exceptions import BadRequestException
from app.shared.validators import clean_string, parse_enum, require_fields, require_json_object, isoformat

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

def _validate_email(value) -> str:
    email = clean_string(value, "email", max_length=100, required=True).lower()
    if not EMAIL_PATTERN.match(email):
        raise BadRequestException("Field 'email' must be a valid email address.")
    return email

def validate_login_payload(payload) -> dict:
    payload = require_json_object(payload)
    require_fields(payload, ["email"])
    return {"email": _validate_email(payload.get("email"))}

def validate_register_payload(payload) -> dict:
    payload = require_json_object(payload)
    require_fields(payload, ["full_name", "email", "role"])
    return {
        "full_name": clean_string(payload.get("full_name"), "full_name", max_length=100, required=True),
        "email": _validate_email(payload.get("email")),
        "role": parse_enum(payload.get("role"), "role", USER_ROLES, required=True),
    }

def validate_role_filter(value):
    return parse_enum(value, "role", USER_ROLES)

def serialize_user(user, default_board_id: int = 1) -> dict:
    memberships = list(user.board_memberships)
    primary = next((m for m in memberships if m.board_id == default_board_id), None)
    if primary is None and memberships:
        primary = memberships[0]
    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "role": primary.role if primary else None,
        "boards": [{"board_id": m.board_id, "role": m.role} for m in memberships],
        "created_at": isoformat(user.created_at),
    }