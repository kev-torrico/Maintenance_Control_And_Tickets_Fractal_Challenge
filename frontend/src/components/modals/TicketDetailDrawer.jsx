import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CircleDot,
  Loader2,
  Lock,
  Pencil,
  RotateCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { ModalBackdrop } from "@/components/ui/modal";
import { ticketService } from "@/services/ticketService";
import { getErrorMessage } from "@/services/apiClient";
import {
  formatDateTime,
  formatStatus,
  humanizeStatusText,
  initials,
  priorityClass,
  PRIORITIES,
  statusClass,
} from "@/utils/formatters";
import { TICKET_STATUS, TRANSITION_MESSAGES } from "@/utils/stateMachine";

const LIMITS = { title: 100, description: 250 };

function TimelineMarker({ status }) {
  if (status === TICKET_STATUS.RESOLVED) return <Check size={11} />;
  if (status === TICKET_STATUS.IN_PROGRESS) return <Activity size={11} />;
  return <CircleDot size={11} />;
}

export function TicketDetailDrawer({
  ticketId,
  syncVersion,
  operators,
  activeUserName,
  canMoveTickets = true,
  isTransitionPending,
  onClose,
  onTransition,
  onResolve,
  onChanged,
  toast,
}) {
  const [ticket, setTicket] = useState(null);
  const [history, setHistory] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const requestSeq = useRef(0);
  const closeButtonRef = useRef(null);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    try {
      const [detail, entries] = await Promise.all([
        ticketService.getTicket(ticketId),
        ticketService.getHistory(ticketId),
      ]);
      if (seq !== requestSeq.current) return;
      setTicket(detail);
      setHistory(entries);
      setLoadError("");
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setLoadError(getErrorMessage(err));
    } finally {
      if (seq === requestSeq.current) setIsLoading(false);
    }
  }, [ticketId]);

  // Initial load + reload on every real-time board sync / local transition.
  useEffect(() => {
    load();
  }, [load, syncVersion]);

  const assigneeOptions = useMemo(() => {
    const options = [...operators];
    if (
      ticket?.assigned_user &&
      !options.some((op) => op.id === ticket.assigned_user.id)
    ) {
      options.push(ticket.assigned_user);
    }
    return options;
  }, [operators, ticket]);

  async function saveChanges(changes, successMessage) {
    setIsSaving(true);
    setFormError("");
    try {
      const updated = await ticketService.updateTicket(
        ticketId,
        changes,
        activeUserName,
      );
      setTicket(updated);
      setHistory(updated.history || (await ticketService.getHistory(ticketId)));
      toast.success(successMessage);
      onChanged?.();
      return true;
    } catch (err) {
      const message = getErrorMessage(err);
      setFormError(message);
      toast.error(message);
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  function handleAssigneeChange(event) {
    const value = event.target.value ? Number(event.target.value) : null;
    if (value === (ticket.assigned_to ?? null)) return;
    const name = assigneeOptions.find((op) => op.id === value)?.full_name;
    saveChanges(
      { assigned_to: value },
      value
        ? `Ticket #${ticket.id} assigned to ${name}.`
        : `Ticket #${ticket.id} unassigned.`,
    );
  }

  function startEditing() {
    setForm({
      title: ticket.title,
      description: ticket.description || "",
      priority: ticket.priority,
      diagnosis: ticket.diagnosis || "",
    });
    setFormError("");
    setIsEditing(true);
  }

  async function handleSave(event) {
    event.preventDefault();
    const next = {
      title: form.title.trim(),
      description: form.description.trim(),
      priority: form.priority,
      diagnosis: form.diagnosis.trim() || null,
    };
    if (!next.title || !next.description) {
      setFormError("Title and description are required.");
      return;
    }
    const changes = {};
    if (next.title !== ticket.title) changes.title = next.title;
    if (next.description !== (ticket.description || ""))
      changes.description = next.description;
    if (next.priority !== ticket.priority) changes.priority = next.priority;
    if ((next.diagnosis || null) !== (ticket.diagnosis || null))
      changes.diagnosis = next.diagnosis;
    if (Object.keys(changes).length === 0) {
      setIsEditing(false);
      return;
    }
    if (await saveChanges(changes, `Ticket #${ticket.id} updated.`))
      setIsEditing(false);
  }

  const timeline = [...history].reverse();

  return (
    <ModalBackdrop onClose={onClose} initialFocusRef={closeButtonRef}>
      <aside
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        aria-busy={isLoading}
      >
        <div className="detail-header">
          <div>
            <div className="dialog-kicker">
              TICKET #{ticketId}{" "}
              {ticket?.asset_code && (
                <>
                  <span>·</span> {ticket.asset_code.name}
                </>
              )}
            </div>
            <h2 id="detail-title">Ticket details</h2>
          </div>
          <button
            ref={closeButtonRef}
            className="close-button"
            type="button"
            onClick={onClose}
            aria-label="Close details"
          >
            <X size={18} />
          </button>
        </div>

        <div className="detail-scroll">
          {isLoading && !ticket && (
            <div className="empty-column">
              <Loader2 size={18} className="spin" />
              <span>Loading ticket…</span>
            </div>
          )}
          {loadError && (
            <div className="board-banner">
              <div className="validation-error" role="alert">
                <AlertCircle size={15} />
                {loadError}
              </div>
              <button className="secondary-button" type="button" onClick={load}>
                <RotateCw size={13} /> Retry
              </button>
            </div>
          )}

          {ticket && !isEditing && (
            <>
              <div className="detail-title-row">
                <h3>{ticket.title}</h3>
                <span
                  className={`priority-badge ${priorityClass(ticket.priority)}`}
                >
                  <span />
                  {ticket.priority}
                </span>
              </div>
              <p className="detail-description">{ticket.description}</p>
              <div className="detail-actions">
                <div className={`detail-status ${statusClass(ticket.status)}`}>
                  <CircleDot size={14} />
                  {formatStatus(ticket.status)}
                </div>
                <span className="card-meta-spacer" style={{ flex: 1 }} />
                <button
                  className="secondary-button"
                  type="button"
                  onClick={startEditing}
                  disabled={isSaving}
                >
                  <Pencil size={13} /> Edit details
                </button>
              </div>
            </>
          )}

          {ticket && isEditing && form && (
            <form className="detail-edit-grid" onSubmit={handleSave} noValidate>
              <label className="form-field">
                <span>
                  Ticket title <b>*</b>
                </span>
                <input
                  maxLength={LIMITS.title}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
              </label>
              <label className="form-field">
                <span>
                  Description <b>*</b>{" "}
                  <small>
                    {form.description.length}/{LIMITS.description}
                  </small>
                </span>
                <textarea
                  rows={3}
                  maxLength={LIMITS.description}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </label>
              <label className="form-field">
                <span>Priority</span>
                <select
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: e.target.value })
                  }
                >
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>
                  Technical diagnosis{" "}
                  {ticket.status === TICKET_STATUS.RESOLVED ? (
                    <b>*</b>
                  ) : (
                    <small>Optional</small>
                  )}
                </span>
                <textarea
                  rows={3}
                  placeholder="Describe the root cause and repair completed…"
                  value={form.diagnosis}
                  onChange={(e) =>
                    setForm({ ...form, diagnosis: e.target.value })
                  }
                />
              </label>
              {formError && (
                <div className="validation-error" role="alert">
                  <AlertCircle size={15} />
                  {formError}
                </div>
              )}
              <div className="detail-footer-row">
                <button
                  type="button"
                  className="secondary-button full-button"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button full-button"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 size={15} className="spin" />
                  ) : (
                    <Check size={15} />
                  )}{" "}
                  Save changes
                </button>
              </div>
            </form>
          )}

          {ticket && (
            <>
              <div className="detail-section">
                <h4>Ticket information</h4>
                <div className="detail-info-grid">
                  <div>
                    <span>Asset code</span>
                    <strong>{ticket.asset_code?.name || "—"}</strong>
                  </div>
                  <div>
                    <span>Ticket ID</span>
                    <strong>#{ticket.id}</strong>
                  </div>
                  <div>
                    <span>Created</span>
                    <strong>{formatDateTime(ticket.created_at)}</strong>
                  </div>
                  <div>
                    <span>Last updated</span>
                    <strong>{formatDateTime(ticket.updated_at)}</strong>
                  </div>
                </div>
                <label className="form-field detail-assignee">
                  <span>
                    Assigned operator{" "}
                    {isSaving && <Loader2 size={11} className="spin" />}
                  </span>
                  <select
                    value={ticket.assigned_to ?? ""}
                    onChange={handleAssigneeChange}
                    disabled={isSaving}
                  >
                    <option value="">Unassigned</option>
                    {assigneeOptions.map((op) => (
                      <option key={op.id} value={op.id}>
                        {op.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                {!isEditing && formError && (
                  <div
                    className="validation-error"
                    role="alert"
                    style={{ marginTop: 10 }}
                  >
                    <AlertCircle size={15} />
                    {formError}
                  </div>
                )}
              </div>

              <div className="detail-section">
                <h4>Technical diagnosis</h4>
                {ticket.diagnosis ? (
                  <div className="diagnosis-display">{ticket.diagnosis}</div>
                ) : (
                  <p className="no-diagnosis">No diagnosis recorded yet.</p>
                )}
              </div>

              <div className="detail-section timeline-section">
                <h4>
                  Timeline <span>{history.length} events</span>
                </h4>
                <div className="timeline">
                  {timeline.map((entry) => (
                    <div className="timeline-item" key={entry.id}>
                      <div
                        className={`timeline-marker ${statusClass(entry.new_status)}`}
                      >
                        <TimelineMarker status={entry.new_status} />
                      </div>
                      <div className="timeline-content">
                        <div className="timeline-transition">
                          <strong>
                            {entry.previous_status
                              ? formatStatus(entry.previous_status)
                              : "Created"}
                          </strong>
                          <ArrowRight size={12} />
                          <strong>{formatStatus(entry.new_status)}</strong>
                        </div>
                        <p>{humanizeStatusText(entry.comment)}</p>
                        <div className="timeline-meta">
                          <span className="timeline-avatar">
                            {initials(entry.changed_by)}
                          </span>
                          {entry.changed_by}
                          <span>·</span>
                          {formatDateTime(entry.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {ticket && (
          <div className="detail-footer">
            {ticket.status !== TICKET_STATUS.RESOLVED && !canMoveTickets && (
              <div className="closed-note" style={{ color: "#78869a" }}>
                <Lock size={15} /> {TRANSITION_MESSAGES.OPERATORS_ONLY}
              </div>
            )}
            {canMoveTickets && ticket.status === TICKET_STATUS.PENDING && (
              <button
                className="primary-button full-button"
                type="button"
                disabled={isTransitionPending}
                onClick={() => onTransition(ticket, TICKET_STATUS.IN_PROGRESS)}
              >
                {isTransitionPending ? (
                  <Loader2 size={15} className="spin" />
                ) : null}{" "}
                Move to in progress <ArrowRight size={15} />
              </button>
            )}
            {canMoveTickets && ticket.status === TICKET_STATUS.IN_PROGRESS && (
              <div className="detail-footer-row">
                <button
                  className="secondary-button full-button"
                  type="button"
                  disabled={isTransitionPending}
                  onClick={() => onTransition(ticket, TICKET_STATUS.PENDING)}
                >
                  <ArrowLeft size={15} /> Return to pending
                </button>
                <button
                  className="primary-button full-button"
                  type="button"
                  disabled={isTransitionPending}
                  onClick={() => onResolve(ticket)}
                >
                  Resolve ticket <Check size={15} />
                </button>
              </div>
            )}
            {ticket.status === TICKET_STATUS.RESOLVED && (
              <div className="closed-note">
                <ShieldCheck size={16} /> This ticket is closed
              </div>
            )}
          </div>
        )}
      </aside>
    </ModalBackdrop>
  );
}
