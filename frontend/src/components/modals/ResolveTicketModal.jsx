import { useRef, useState } from "react";
import { AlertCircle, Check, Loader2, X } from "lucide-react";
import { ModalBackdrop } from "@/components/ui/modal";
import { getErrorMessage } from "@/services/apiClient";
import { validateResolution } from "@/utils/stateMachine";

const COMMENT_LIMIT = 250;

export function ResolveTicketModal({
  ticket,
  activeUserName,
  onCancel,
  onConfirm,
}) {
  const [diagnosis, setDiagnosis] = useState(ticket.diagnosis || "");
  const [comment, setComment] = useState("");
  const [validation, setValidation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const diagnosisRef = useRef(null);

  async function handleConfirm(event) {
    event.preventDefault();
    const error = validateResolution(diagnosis);
    if (error) {
      setValidation(error);
      diagnosisRef.current?.focus();
      return;
    }
    setIsSubmitting(true);
    try {
      await onConfirm({
        diagnosis: diagnosis.trim(),
        comment: comment.trim() || null,
      });
    } catch (err) {
      setValidation(getErrorMessage(err));
      setIsSubmitting(false);
    }
  }

  const cancel = () => !isSubmitting && onCancel();

  return (
    <ModalBackdrop onClose={cancel} initialFocusRef={diagnosisRef}>
      <section
        className="dialog compact-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resolve-title"
      >
        <div className="dialog-header">
          <div>
            <div className="dialog-kicker">COMPLETE WORK ORDER</div>
            <h2 id="resolve-title">Resolve ticket #{ticket.id}</h2>
            <p>Document the work performed before closing this ticket.</p>
          </div>
          <button
            className="close-button"
            type="button"
            onClick={cancel}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleConfirm} noValidate>
          <div className="form-grid">
            <label className="form-field full">
              <span>
                Technical diagnosis <b>*</b>
              </span>
              <textarea
                ref={diagnosisRef}
                rows={4}
                placeholder="Describe the root cause and repair completed…"
                value={diagnosis}
                aria-invalid={!!validation}
                aria-describedby="diagnosis-hint"
                onChange={(event) => {
                  setDiagnosis(event.target.value);
                  setValidation("");
                }}
              />
              <small id="diagnosis-hint" className="field-hint">
                A diagnosis is required to resolve a ticket.
              </small>
            </label>
            <label className="form-field full">
              <span>
                Transition comment <small>Optional</small>
              </span>
              <textarea
                rows={2}
                maxLength={COMMENT_LIMIT}
                placeholder="Add a note for the audit trail…"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            </label>
            {validation && (
              <div className="validation-error" role="alert">
                <AlertCircle size={15} />
                {validation}
              </div>
            )}
          </div>
          <div className="dialog-footer">
            <span>Action by {activeUserName || "—"}</span>
            <div>
              <button
                type="button"
                className="secondary-button"
                onClick={cancel}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 size={15} className="spin" />
                ) : (
                  <Check size={15} />
                )}
                {isSubmitting ? "Resolving…" : "Mark resolved"}
              </button>
            </div>
          </div>
        </form>
      </section>
    </ModalBackdrop>
  );
}
