import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BenchNav from "./BenchNav";
import { signOut } from "./auth";

vi.mock("./auth", () => ({ signOut: vi.fn() }));

const nav = () => within(screen.getByRole("navigation", { name: "Primary" }));

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
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
});
