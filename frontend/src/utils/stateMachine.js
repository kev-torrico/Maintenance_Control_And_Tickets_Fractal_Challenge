export const TICKET_STATUS = Object.freeze({
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
});

export const ALLOWED_TRANSITIONS = Object.freeze({
  [TICKET_STATUS.PENDING]: [TICKET_STATUS.IN_PROGRESS],
  [TICKET_STATUS.IN_PROGRESS]: [TICKET_STATUS.RESOLVED, TICKET_STATUS.PENDING],
  [TICKET_STATUS.RESOLVED]: [],
});

export const TRANSITION_MESSAGES = Object.freeze({
  SKIP_IN_PROGRESS:
    "Invalid transition: Tickets must pass through In progress before being Resolved.",
  REOPEN_RESOLVED: "Closed tickets cannot be reopened directly.",
  DIAGNOSIS_REQUIRED:
    "Technical diagnosis is required before marking a ticket as Resolved.",
  NOT_ALLOWED: "Invalid transition according to workflow rules.",
  OPERATORS_ONLY:
    "Only operators can move tickets. Switch to an operator to change ticket status.",
});

/** Only OPERATORs may move tickets (mirrors the backend 403 rule). */
export const canMoveTickets = (role) =>
  String(role || "").toUpperCase() === "OPERATOR";

/** Possible outcomes of evaluating a move. */
export const TRANSITION_RESULT = Object.freeze({
  REORDER: "REORDER",
  ALLOWED: "ALLOWED",
  REQUIRES_DIAGNOSIS: "REQUIRES_DIAGNOSIS",
  BLOCKED: "BLOCKED",
});

export const normalizeStatus = (status) =>
  String(status || "")
    .trim()
    .toUpperCase();

export const hasDiagnosis = (value) =>
  typeof value === "string" && value.trim().length > 0;

/**
 * Evaluate a status transition before calling the API.
 * IN_PROGRESS -> RESOLVED always returns REQUIRES_DIAGNOSIS so the UI opens the
 * diagnosis modal (pre-filled with any diagnosis already stored on the ticket).
 * @returns {{ result: string, message?: string }}
 */
export function evaluateTransition(fromStatus, toStatus) {
  const from = normalizeStatus(fromStatus);
  const to = normalizeStatus(toStatus);

  if (from === to) return { result: TRANSITION_RESULT.REORDER };

  if (from === TICKET_STATUS.RESOLVED) {
    return {
      result: TRANSITION_RESULT.BLOCKED,
      message: TRANSITION_MESSAGES.REOPEN_RESOLVED,
    };
  }
  if (from === TICKET_STATUS.PENDING && to === TICKET_STATUS.RESOLVED) {
    return {
      result: TRANSITION_RESULT.BLOCKED,
      message: TRANSITION_MESSAGES.SKIP_IN_PROGRESS,
    };
  }
  if (!(ALLOWED_TRANSITIONS[from] || []).includes(to)) {
    return {
      result: TRANSITION_RESULT.BLOCKED,
      message: TRANSITION_MESSAGES.NOT_ALLOWED,
    };
  }
  if (to === TICKET_STATUS.RESOLVED) {
    return { result: TRANSITION_RESULT.REQUIRES_DIAGNOSIS };
  }
  return { result: TRANSITION_RESULT.ALLOWED };
}

/** Validate the diagnosis captured by the Resolve modal. Returns an error message or null. */
export function validateResolution(diagnosis) {
  return hasDiagnosis(diagnosis)
    ? null
    : TRANSITION_MESSAGES.DIAGNOSIS_REQUIRED;
}
