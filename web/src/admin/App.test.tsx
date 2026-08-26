/** The panel's gate: admins in, everyone else sent where the session belongs. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import { redirectTo, useSession } from "../shared/auth";
import { adminApi } from "./api";

vi.mock("../shared/auth", () => ({
  useSession: vi.fn(),
  redirectTo: vi.fn(),
}));

vi.mock("./api", () => ({
  adminApi: { list: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminApi.list).mockResolvedValue([]);
});

const admin = {
  username: "marco",
  role: "admin" as const,
  mustChangePassword: false,
};

describe("the admin panel gate", () => {
  it("sends an outsider to the login document", async () => {
    vi.mocked(useSession).mockReturnValue(null);
    render(<App />);
    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("/login"));
  });

  it("sends a user with a temporary password to the change page", async () => {
    vi.mocked(useSession).mockReturnValue({
      ...admin,
      mustChangePassword: true,
    });
    render(<App />);
    await waitFor(() =>
      expect(redirectTo).toHaveBeenCalledWith("/change-password"),
    );
  });

  it("keeps a plain user out of the panel", async () => {
    vi.mocked(useSession).mockReturnValue({ ...admin, role: "user" });
    render(<App />);
    await waitFor(() => expect(redirectTo).toHaveBeenCalledWith("/"));
  });
});

describe("the panel for an admin", () => {
  it("lists every user from the API", async () => {
    vi.mocked(useSession).mockReturnValue(admin);
    vi.mocked(adminApi.list).mockResolvedValue([
      {
        id: 1,
        username: "marco",
        role: "admin",
        mustChangePassword: false,
      },
      {
        id: 2,
        username: "luca",
        role: "user",
        mustChangePassword: true,
      },
    ]);
    render(<App />);
    expect(
      await screen.findByRole("heading", { name: "Users" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("marco")).toBeInTheDocument();
    expect(await screen.findByText("luca")).toBeInTheDocument();
  });

  it("marks itself as the current page in the nav", async () => {
    vi.mocked(useSession).mockReturnValue(admin);
    render(<App />);
    const nav = await screen.findByRole("navigation", { name: "Primary" });
    expect(nav).toBeInTheDocument();
  });
});
