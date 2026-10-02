import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BenchNav from "./BenchNav";
import { getTenants, signOut, useSession } from "./auth";

vi.mock("./auth", () => ({
  signOut: vi.fn(),
  useSession: vi.fn(() => null),
  getTenants: vi.fn(() => Promise.resolve([])),
  selectTenant: vi.fn(),
  selectedTenantId: vi.fn(() => null),
}));

const nav = () => within(screen.getByRole("navigation", { name: "Primary" }));

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  vi.mocked(useSession).mockReturnValue(null);
  vi.mocked(getTenants).mockResolvedValue([]);
});

describe("BenchNav", () => {
  it("offers the launcher and all three apps, in order", () => {
    render(<BenchNav active="crm" />);
    expect(
      nav()
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Home", "/"],
      ["CRM", "/crm/"],
      ["Space", "/space/"],
      ["Rolodex", "/rolodex/"],
    ]);
  });

  it("marks only the app it is rendered in", () => {
    render(<BenchNav active="space" />);
    const current = nav()
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual(["Space"]);
  });

  it("carries the company brand", () => {
    render(<BenchNav active="home" />);
    expect(screen.getByText("Novhora")).toBeInTheDocument();
  });

  it("toggles the theme for every app and remembers the choice", async () => {
    render(<BenchNav active="rolodex" />);
    await userEvent.click(screen.getByRole("button", { name: /Switch to/ }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("bench.theme")).toBe("dark");

    await userEvent.click(screen.getByRole("button", { name: /Switch to/ }));
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("bench.theme")).toBe("light");
  });

  it("signs out from the strip", async () => {
    render(<BenchNav active="crm" />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalled();
  });

  it("offers the admin panel only to admins", () => {
    vi.mocked(useSession).mockReturnValue({
      email: "marco@example.com",
      role: "admin",
      mustChangePassword: false,
      masterAdmin: true,
    });
    render(<BenchNav active="home" />);
    expect(nav().getByRole("link", { name: "Admin" })).toBeInTheDocument();
  });

  it("offers a tenant switcher to a master admin, and not to others", async () => {
    vi.mocked(useSession).mockReturnValue({
      email: "marco@example.com",
      role: "owner",
      mustChangePassword: false,
      masterAdmin: true,
    });
    vi.mocked(getTenants).mockResolvedValue([
      { id: 1, name: "Novhora", slug: "novhora" },
      { id: 2, name: "Second Co", slug: "second" },
    ]);
    render(<BenchNav active="home" />);
    const select = await screen.findByRole("combobox", { name: "Tenant" });
    expect(select).toBeInTheDocument();
    expect(
      within(select).getByRole("option", { name: "Second Co" }),
    ).toBeInTheDocument();
  });
});
