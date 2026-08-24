/**
 * The one gate in front of every app. Signing in sets the session cookie and lands on the
 * launcher; every app page and every other /api route answers 401 or redirects back here
 * without it.
 */
import { useEffect, useState, type SyntheticEvent } from "react";
import { redirectTo } from "../shared/auth";
import { BRAND } from "../shared/brand";

export default function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in: straight to the launcher, no second form to click through.
  useEffect(() => {
    void fetch("/api/auth/me").then((res) => {
      if (res.ok) redirectTo("/");
    });
  }, []);

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (res.ok) {
      redirectTo("/");
      return;
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setError(body.error ?? "Could not sign in");
    setBusy(false);
  }

  return (
    <main className="login">
      <form className="login-card" onSubmit={(e) => void submit(e)}>
        <h1 className="login-brand">
          <BRAND.Mark size={28} />
          {BRAND.name}
        </h1>
        <p className="login-lede">Sign in to reach your apps.</p>
        <label className="login-field">
          Username
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="login-field">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        <button className="login-submit" type="submit" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
