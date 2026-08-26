/**
 * The forced password change: a user whose password was set by an admin lands here straight from
 * login, and stays - the server sends every other page and API here - until a new password is
 * set. Anyone already holding a real password is sent on to the launcher.
 */
import { useEffect, useState, type SyntheticEvent } from "react";
import { getSession, redirectTo } from "../shared/auth";
import { BRAND } from "../shared/brand";

export default function App() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getSession().then((session) => {
      if (!session) redirectTo("/login");
      else if (!session.mustChangePassword) redirectTo("/");
    });
  }, []);

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError("The two passwords do not match");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      redirectTo("/");
      return;
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setError(body.error ?? "Could not change the password");
    setBusy(false);
  }

  return (
    <main className="reset">
      <form className="reset-card" onSubmit={(e) => void submit(e)}>
        <h1 className="reset-brand">
          <BRAND.Mark size={28} />
          {BRAND.name}
        </h1>
        <p className="reset-lede">
          Choose a new password before you go any further.
        </p>
        <label className="reset-field">
          New password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <label className="reset-field">
          Repeat password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        {error && (
          <p className="reset-error" role="alert">
            {error}
          </p>
        )}
        <button className="reset-submit" type="submit" disabled={busy}>
          {busy ? "Changing…" : "Set password"}
        </button>
      </form>
    </main>
  );
}
