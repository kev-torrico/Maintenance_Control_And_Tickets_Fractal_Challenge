from app.shared.exceptions import BusinessRuleException

PENDING = "PENDING"
IN_PROGRESS = "IN_PROGRESS"
RESOLVED = "RESOLVED"
TICKET_STATUSES = (PENDING, IN_PROGRESS, RESOLVED)
ALLOWED_TRANSITIONS = {
    PENDING: {IN_PROGRESS},
    IN_PROGRESS: {RESOLVED, PENDING},
    RESOLVED: set(),
}

def normalize_status(status) -> str:
    return (status or "").strip().upper()

def has_diagnosis(value) -> bool:
    return isinstance(value, str) and bool(value.strip())

def validate_transition(current_status, target_status, request_diagnosis=None, current_diagnosis=None) -> None:
    """Raise BusinessRuleException when the transition violates workflow rules.
    - Same status -> same status is always allowed (reordering inside a list).
    - PENDING -> IN_PROGRESS, IN_PROGRESS -> PENDING are allowed.
    - IN_PROGRESS -> RESOLVED requires a non-empty diagnosis, either provided
      in the request or already stored on the ticket.
    - Everything else (e.g. PENDING -> RESOLVED, reopening RESOLVED) is forbidden.
    """
    current = normalize_status(current_status)
    target = normalize_status(target_status)

    if target not in TICKET_STATUSES:
        raise BusinessRuleException(
            f"Unknown target status '{target_status}'.",
            details={"allowed_statuses": list(TICKET_STATUSES)},
        )

    if current == target:
        return

    if target not in ALLOWED_TRANSITIONS.get(current, set()):
        if current == RESOLVED:
            reason = "Resolved tickets are closed and cannot be reopened directly."
        elif current == PENDING and target == RESOLVED:
            reason = "A ticket must be IN_PROGRESS before it can be RESOLVED."
        else:
            reason = "Transition is not allowed by the workflow rules."
        raise BusinessRuleException(
            f"Invalid status transition {current} -> {target}. {reason}",
            details={
                "current_status": current,
                "target_status": target,
                "allowed_targets": sorted(ALLOWED_TRANSITIONS.get(current, set())),
            },
        )

    if target == RESOLVED and not (has_diagnosis(request_diagnosis) or has_diagnosis(current_diagnosis)):
        raise BusinessRuleException(
            "A technical diagnosis is required before marking a ticket as RESOLVED.",
            details={"current_status": current, "target_status": target, "field": "diagnosis"},
        )

def allowed_targets(current_status) -> list:
    return sorted(ALLOWED_TRANSITIONS.get(normalize_status(current_status), set()))