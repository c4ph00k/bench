/** One user: their role, the reset-password flow, and deletion - each with its own confirmation. */
import { useState, type SyntheticEvent } from "react";
import type { Role } from "../shared/auth";
import { adminApi, type PublicUser } from "./api";

interface Props {
  user: PublicUser;
  onChanged: () => void;
}

export function UserRow({ user, onChanged }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [password, setPassword] = useState("");

  // The seeded bootstrap admin cannot be deleted - the server refuses it too, so the button is
  // not offered. Same name the server guards on in server/src/auth/admin.ts.
  const seededAdmin = user.username === "marco";

  function fail(err: unknown, fallback: string) {
    setError(err instanceof Error ? err.message : fallback);
  }

  async function changeRole(role: Role) {
    setBusy(true);
    setError(null);
    try {
      await adminApi.update(user.id, { role });
      onChanged();
    } catch (err) {
      fail(err, "Could not change the role");
    } finally {
      setBusy(false);
    }
  }

  async function submitReset(event: SyntheticEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminApi.resetPassword(user.id, password);
      setPassword("");
      setResetting(false);
      onChanged();
    } catch (err) {
      fail(err, "Could not reset the password");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await adminApi.remove(user.id);
      onChanged();
    } catch (err) {
      fail(err, "Could not delete the user");
      setConfirmingDelete(false);
      setBusy(false);
    }
  }

  return (
    <li className="admin-user">
      <div className="admin-user-main">
        <strong className="admin-username">{user.username}</strong>
        {user.mustChangePassword && (
          <span className="admin-flag">Temporary password</span>
        )}
        <select
          className="admin-role"
          aria-label={`Role for ${user.username}`}
          value={user.role}
          disabled={busy}
          onChange={(e) => void changeRole(e.target.value as Role)}
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <div className="admin-user-actions">
        <button
          type="button"
          onClick={() => setResetting((open) => !open)}
          disabled={busy}
        >
          Reset password
        </button>
        {!seededAdmin && !confirmingDelete && (
          <button
            type="button"
            className="admin-danger"
            onClick={() => setConfirmingDelete(true)}
            disabled={busy}
          >
            Delete
          </button>
        )}
        {!seededAdmin && confirmingDelete && (
          <>
            <button
              type="button"
              className="admin-danger"
              onClick={() => void remove()}
              disabled={busy}
            >
              Confirm delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={busy}
            >
              Cancel
            </button>
          </>
        )}
      </div>

      {resetting && (
        <form className="admin-reset" onSubmit={(e) => void submitReset(e)}>
          <label className="admin-field">
            New temporary password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </label>
          <button type="submit" disabled={busy}>
            Set temporary password
          </button>
          <button
            type="button"
            onClick={() => setResetting(false)}
            disabled={busy}
          >
            Cancel
          </button>
        </form>
      )}

      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
