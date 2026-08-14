import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import BenchNav from "./BenchNav";

const nav = () => within(screen.getByRole("navigation", { name: "Primary" }));

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
      ["Groove", "/groove/"],
    ]);
  });

  it("marks only the app it is rendered in", () => {
    render(<BenchNav active="space" />);
    const current = nav()
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual(["Space"]);
  });

  it("colours the active tab with that app's colour", () => {
    render(<BenchNav active="groove" />);
    expect(nav().getByRole("link", { name: "Groove" })).toHaveStyle({
      borderBottomColor: "#a066d8",
    });
  });

  it("names the project", () => {
    render(<BenchNav active="home" />);
    expect(screen.getByText("Bench")).toBeInTheDocument();
  });
});
