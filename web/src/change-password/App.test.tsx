/** The forced change page: the redirects it owes, the mismatch it refuses, and the save it makes. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { getSession, redirectTo } from "../shared/auth";

vi.mock("../shared/auth", () => ({
  getSession: vi.fn(),
  redirectTo: vi.fn(),
}));

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the forced password change", () => {
  it("sends an outsider to the login document", async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    render(<App />);
    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("/login"));
  });

  it("sends someone with a real password on to the launcher", async () => {
    vi.mocked(getSession).mockResolvedValue({
      username: "marco",
      role: "admin",
      mustChangePassword: false,
    });
    render(<App />);
    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("/"));
  });

  it("refuses two passwords that do not match", async () => {
    vi.mocked(getSession).mockResolvedValue({
      username: "luca",
      role: "user",
      mustChangePassword: true,
    });
    render(<App />);
    await userEvent.type(screen.getByLabelText("New password"), "pass1");
    await userEvent.type(screen.getByLabelText("Repeat password"), "pass2");
    await userEvent.click(screen.getByRole("button", { name: "Set password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The two passwords do not match",
    );
  });

  it("saves the new password and lands on the launcher", async () => {
    vi.mocked(getSession).mockResolvedValue({
      username: "luca",
      role: "user",
      mustChangePassword: true,
    });
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse(204, {}));
    render(<App />);
    await userEvent.type(screen.getByLabelText("New password"), "pass1");
    await userEvent.type(screen.getByLabelText("Repeat password"), "pass1");
    await userEvent.click(screen.getByRole("button", { name: "Set password" }));
    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("/"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/change-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ password: "pass1" }),
      }),
    );
    vi.unstubAllGlobals();
  });
});
