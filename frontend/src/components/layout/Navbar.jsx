import {
  Bell,
  ChevronDown,
  FilePlus2,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { formatRole, initials } from "@/utils/formatters";

export function Navbar({
  users,
  activeUser,
  onUserChange,
  onNewTicket,
  isConnected,
  isLoadingUsers,
}) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <Wrench size={19} />
          <ShieldCheck size={12} className="shield-mini" />
        </div>
        <div>
          <div className="brand-name">
            Maintenance &amp; Infrastructure Control
          </div>
          <div className="brand-sub">Enterprise operations workspace</div>
        </div>
      </div>
      <div className="top-actions">
        <label className="user-select">
          <span className="user-avatar">{initials(activeUser?.full_name)}</span>
          <select
            aria-label="Active user"
            value={activeUser?.id ?? ""}
            disabled={isLoadingUsers || users.length === 0}
            onChange={(event) => onUserChange(event.target.value)}
          >
            {users.length === 0 && (
              <option value="">
                {isLoadingUsers ? "Loading users…" : "No users"}
              </option>
            )}
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name} ({formatRole(user.role)})
              </option>
            ))}
          </select>
          <ChevronDown size={14} />
        </label>
        <button
          className="icon-button notifications"
          aria-label={
            isConnected
              ? "Real-time updates connected"
              : "Real-time updates disconnected"
          }
          title={
            isConnected
              ? "Real-time updates connected"
              : "Real-time updates disconnected"
          }
          type="button"
        >
          <Bell size={18} />
          <i style={isConnected ? undefined : { background: "#c1c9d1" }} />
        </button>
        <button
          className="primary-button"
          onClick={onNewTicket}
          disabled={!activeUser}
          type="button"
        >
          <FilePlus2 size={16} /> New Ticket
        </button>
      </div>
    </header>
  );
}
