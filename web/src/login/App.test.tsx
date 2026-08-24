/**
 * The gate's client half. Navigation goes through shared/auth's redirectTo, which is mocked
 * here: jsdom cannot navigate, and the point is what was asked for, not the going.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { redirectTo } from "../shared/auth";

vi.mock("../shared/auth", () => ({
  redirectTo: vi.fn(),
  signOut: vi.fn(),
}));

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: () => Promise.resolve(body) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the login document", () => {
  it("signs in and lands on the launcher", async () => {
    const fetchMock = vi
      .fn()
      // First the mount-time /me probe (no session yet), then the login itself.
      .mockResolvedValueOnce(jsonResponse(401, { error: "Not signed in" }))
      .mockResolvedValue(jsonResponse(200, { username: "marco" }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await userEvent.type(screen.getByLabelText("Username"), "marco");
    await userEvent.type(screen.getByLabelText("Password"), "bench");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("/"));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "marco", password: "bench" }),
    });
    vi.unstubAllGlobals();
  });

  it("shows the server's message and stays put on a bad password", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        // First the mount-time /me probe, then the rejected login.
        .mockResolvedValueOnce(jsonResponse(401, { error: "Not signed in" }))
        .mockResolvedValue(
          jsonResponse(401, { error: "Wrong username or password" }),
        ),
    );
    render(<App />);
    await userEvent.type(screen.getByLabelText("Username"), "marco");
    await userEvent.type(screen.getByLabelText("Password"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    // role=alert carries no accessible name, so the message is asserted as text.
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Wrong username or password");
    expect(redirectTo).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("goes straight to the launcher when a session is already live", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { username: "marco" })),
    );
    render(<App />);
    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("/"));
    vi.unstubAllGlobals();
  });
});
