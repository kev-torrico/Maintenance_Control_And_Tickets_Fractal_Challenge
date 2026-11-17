from app.shared.exceptions import BadRequestException

def get_json_body(request) -> dict:
    """Parse the request body as a JSON object or raise a 400."""
    payload = request.get_json(silent=True)
    if payload is None:
        raise BadRequestException(
            "Request body must be valid JSON (Content-Type: application/json)."
        )
    return require_json_object(payload)

def require_json_object(payload) -> dict:
    if not isinstance(payload, dict):
        raise BadRequestException("Request body must be a valid JSON object.")
    return payload

def require_fields(payload: dict, fields) -> None:
    missing = [
        field for field in fields
        if payload.get(field) is None
        or (isinstance(payload.get(field), str) and not payload.get(field).strip())
    ]
    if missing:
        raise BadRequestException(
            f"Missing required field(s): {', '.join(missing)}.",
            details={"missing_fields": missing},
        )

def clean_string(value, field: str, max_length: int = None, required: bool = False):
    """Return a trimmed string (or None) after type and length validation."""
    if value is None:
        if required:
            raise BadRequestException(f"Field '{field}' is required.")
        return None
    if not isinstance(value, str):
        raise BadRequestException(f"Field '{field}' must be a string.")
    value = value.strip()
    if required and not value:
        raise BadRequestException(f"Field '{field}' cannot be empty.")
    if max_length is not None and len(value) > max_length:
        raise BadRequestException(
            f"Field '{field}' must not exceed {max_length} characters."
        )
    return value

def parse_int(value, field: str, required: bool = False, min_value: int = None):
    """Parse an integer from JSON or query-string input (bools are rejected)."""
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise BadRequestException(f"Field '{field}' is required.")
        return None
    if isinstance(value, bool):
        raise BadRequestException(f"Field '{field}' must be an integer.")
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise BadRequestException(f"Field '{field}' must be an integer.")
    if isinstance(value, float) and value != parsed:
        raise BadRequestException(f"Field '{field}' must be an integer.")
    if min_value is not None and parsed < min_value:
        raise BadRequestException(f"Field '{field}' must be >= {min_value}.")
    return parsed

def parse_enum(value, field: str, allowed, required: bool = False):
    """Validate a case-insensitive enum value and return its uppercase form."""
    if value is None or (isinstance(value, str) and not value.strip()):
        if required:
            raise BadRequestException(f"Field '{field}' is required.")
        return None
    if not isinstance(value, str):
        raise BadRequestException(f"Field '{field}' must be a string.")
    normalized = value.strip().upper()
    if normalized not in allowed:
        raise BadRequestException(
            f"Field '{field}' must be one of: {', '.join(allowed)}."
        )
    return normalized

def isoformat(value):
    return value.isoformat() if value is not None else None