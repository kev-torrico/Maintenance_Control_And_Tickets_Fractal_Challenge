import { Activity, Check, CircleDot, Clock3 } from "lucide-react";

export const STATUS_META = Object.freeze({
  PENDING: { label: "Pending", tone: "amber", icon: Clock3 },
  IN_PROGRESS: { label: "In progress", tone: "blue", icon: Activity },
  RESOLVED: { label: "Resolved", tone: "green", icon: Check },
});
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"];
export function getStatusMeta(status) {
  const key = String(status || "")
    .trim()
    .toUpperCase();
  return (
    STATUS_META[key] || {
      label: key || "Unknown",
      tone: "slate",
      icon: CircleDot,
    }
  );
}

export function formatStatus(status) {
  if (!status) return "—";
  return getStatusMeta(status).label;
}

const STATUS_CODE_PATTERN = /\b(PENDING|IN_PROGRESS|RESOLVED)\b/g;

export function humanizeStatusText(text) {
  if (typeof text !== "string") return text;
  return text.replace(STATUS_CODE_PATTERN, (code) => STATUS_META[code].label);
}

/** CSS modifier used by .priority-badge (high | medium | low). */
export const priorityClass = (priority) =>
  String(priority || "MEDIUM").toLowerCase();

/** CSS modifier used by .detail-status / .timeline-marker (pending | in_progress | resolved). */
export const statusClass = (status) => String(status || "").toLowerCase();

export function initials(name) {
  if (!name || name === "Unassigned") return "—";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

/**
 * The API returns naive ISO timestamps (MySQL TIMESTAMP in server local time).
 * They are parsed as local time by the browser.
 */
export function parseDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "Nov 17, 2026 · 09:42 AM" (prototype timeline format). */
export function formatDateTime(value) {
  const date = parseDate(value);
  if (!date) return "—";
  const day = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
}

/** "Today" / "Yesterday" / "Nov 12" for compact card dates. */
export function formatShortDate(value, now = new Date()) {
  const date = parseDate(value);
  if (!date) return "—";
  const startOf = (d) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  const options = { month: "short", day: "numeric" };
  if (date.getFullYear() !== now.getFullYear()) options.year = "numeric";
  return date.toLocaleDateString("en-US", options);
}

/** "just now" / "5 min ago" / "2 h ago" / "3 d ago". */
export function formatRelativeTime(value, now = new Date()) {
  const date = parseDate(value);
  if (!date) return "—";
  const seconds = Math.max(
    0,
    Math.round((now.getTime() - date.getTime()) / 1000),
  );
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

export const ROLE = Object.freeze({
  OPERATOR: "OPERATOR",
  REPORTER: "REPORTER",
});

export function formatRole(role) {
  if (!role) return "Member";
  return role.charAt(0) + role.slice(1).toLowerCase();
}
