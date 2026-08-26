/** The panel's gate and data: admins only, listing everyone who can sign in. */
import { useEffect, useState } from "react";
import BenchNav from "../shared/BenchNav";
import { redirectTo, useSession } from "../shared/auth";
import { adminApi, type PublicUser } from "./api";
import { UserForm } from "./UserForm";
import { UserRow } from "./UserRow";

export default function App() {
  const session = useSession();
  const [users, setUsers] = useState<PublicUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session === undefined) return;
    if (session === null) {
      redirectTo("/login");
      return;
    }
    if (session.mustChangePassword) {
      redirectTo("/change-password");
      return;
    }
    if (session.role !== "admin") redirectTo("/");
  }, [session]);

  useEffect(() => {
    if (session?.role !== "admin") return;
    adminApi
      .list()
      .then(setUsers)
      .catch(() => setError("Could not load the users"));
  }, [session?.role]);

  if (session?.role !== "admin") return null;

  function reload() {
    adminApi
      .list()
      .then(setUsers)
      .catch(() => setError("Could not load the users"));
  }

  function userList(rows: PublicUser[] | null) {
    if (rows === null) return <p className="admin-empty">Loading…</p>;
    if (rows.length === 0) return <p className="admin-empty">No users.</p>;
    return (
      <ul className="admin-users">
        {rows.map((user) => (
          <UserRow key={user.id} user={user} onChanged={reload} />
        ))}
      </ul>
    );
  }

  return (
    <>
      <BenchNav active="admin" />
      <main className="admin">
        <header className="admin-header">
          <p className="admin-eyebrow">Administration</p>
          <h1>Users</h1>
          <p className="admin-lede">Who can sign in, and what they can do.</p>
        </header>

        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
        )}

        <UserForm onCreated={reload} />

        <section className="admin-list" aria-label="Users">
          {userList(users)}
        </section>
      </main>
    </>
  );
}
