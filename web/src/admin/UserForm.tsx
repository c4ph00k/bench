/** The add-user form: name, a temporary password, and the role. */
import { useState, type SyntheticEvent } from "react";
import type { Role } from "../shared/auth";
import { adminApi } from "./api";

export function UserForm({ onCreated }: { onCreated: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminApi.create(username.trim(), password, role);
      setUsername("");
      setPassword("");
      setRole("user");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the user");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={(e) => void submit(e)}>
      <h2>Add a user</h2>
      <label className="admin-field">
        Username
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="off"
          required
        />
      </label>
      <label className="admin-field">
        Temporary password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </label>
      <div className="admin-field">
        <label htmlFor="new-user-role">Role</label>
        <select
          id="new-user-role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <button className="admin-submit" type="submit" disabled={busy}>
        {busy ? "Adding…" : "Add user"}
      </button>
    </form>
  );
}
