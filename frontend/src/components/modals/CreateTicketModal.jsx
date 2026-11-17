import { useRef, useState } from "react";
import { AlertCircle, FilePlus2, Loader2, X } from "lucide-react";
import { ModalBackdrop } from "@/components/ui/modal";
import { ticketService } from "@/services/ticketService";
import { getErrorMessage } from "@/services/apiClient";
import { formatStatus, PRIORITIES } from "@/utils/formatters";

const EMPTY_FORM = {
  title: "",
  assetCode: "",
  priority: "MEDIUM",
  description: "",
  assignedTo: "",
};
const LIMITS = { title: 100, assetCode: 100, description: 250 };

export function CreateTicketModal({
  targetList,
  assetOptions,
  operators,
  activeUserName,
  onClose,
  onCreated,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleRef = useRef(null);

  const set = (key) => (event) => {
    const value =
      key === "assetCode"
        ? event.target.value.toUpperCase()
        : event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  };

  async function handleSubmit(event) {
    event.preventDefault();
    const title = form.title.trim();
    const assetCode = form.assetCode.trim();
    const description = form.description.trim();
    if (!title || !assetCode || !description) {
      setError("Title, asset code and description are required.");
      return;
    }
    if (!activeUserName) {
      setError("Select an active user before creating a ticket.");
      return;
    }

    setIsSubmitting(true);
    try {
      const ticket = await ticketService.createTicket({
        title,
        description,
        priority: form.priority,
        assetCode,
        listId: targetList?.id,
        assignedTo: form.assignedTo ? Number(form.assignedTo) : null,
        createdBy: activeUserName,
      });
      onCreated(ticket);
    } catch (err) {
      setError(getErrorMessage(err));
      setIsSubmitting(false);
    }
  }

  const close = () => !isSubmitting && onClose();

  return (
    <ModalBackdrop onClose={close} initialFocusRef={titleRef}>
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-title"
      >
        <div className="dialog-header">
          <div>
            <div className="dialog-kicker">MAINTENANCE REQUEST</div>
            <h2 id="create-title">Create new ticket</h2>
            <p>
              Provide the details to get this issue into the queue
              {targetList ? (
                <>
                  {" "}
                  — it will be added to <b>{formatStatus(targetList.title)}</b>.
                </>
              ) : (
                "."
              )}
            </p>
          </div>
          <button
            className="close-button"
            type="button"
            onClick={close}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid">
            <label className="form-field full">
              <span>
                Ticket title <b>*</b>
              </span>
              <input
                ref={titleRef}
                required
                maxLength={LIMITS.title}
                placeholder="e.g. Air conditioning failure"
                value={form.title}
                onChange={set("title")}
              />
            </label>
            <label className="form-field">
              <span>
                Asset code <b>*</b>
              </span>
              <input
                required
                maxLength={LIMITS.assetCode}
                list="asset-suggestions"
                placeholder="Select or enter asset"
                value={form.assetCode}
                onChange={set("assetCode")}
              />
              <datalist id="asset-suggestions">
                {assetOptions.map((asset) => (
                  <option key={asset} value={asset} />
                ))}
              </datalist>
            </label>
            <label className="form-field">
              <span>Priority</span>
              <select value={form.priority} onChange={set("priority")}>
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field full">
              <span>
                Description <b>*</b>{" "}
                <small>
                  {form.description.length}/{LIMITS.description}
                </small>
              </span>
              <textarea
                required
                rows={3}
                maxLength={LIMITS.description}
                placeholder="Describe the issue and any relevant details…"
                value={form.description}
                onChange={set("description")}
              />
            </label>
            <label className="form-field full">
              <span>
                Assign operator <small>Optional</small>
              </span>
              <select value={form.assignedTo} onChange={set("assignedTo")}>
                <option value="">Unassigned</option>
                {operators.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.full_name}
                  </option>
                ))}
              </select>
            </label>
            {error && (
              <div className="validation-error" role="alert">
                <AlertCircle size={15} />
                {error}
              </div>
            )}
          </div>
          <div className="dialog-footer">
            <span>
              <span className="live-dot" /> Created by {activeUserName || "—"}
            </span>
            <div>
              <button
                type="button"
                className="secondary-button"
                onClick={close}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 size={15} className="spin" />
                ) : (
                  <FilePlus2 size={15} />
                )}
                {isSubmitting ? "Creating…" : "Create ticket"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </ModalBackdrop>
  );
}
