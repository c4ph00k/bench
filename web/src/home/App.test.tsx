import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import App from "./App";

describe("launcher", () => {
  it("links each app card at its own document root", () => {
    render(<App />);
    for (const [name, href] of [
      ["CRM", "/crm/"],
      ["Space", "/space/"],
      ["Groove", "/groove/"],
    ]) {
      expect(
        screen.getByRole("heading", { name }).closest("a")!,
      ).toHaveAttribute("href", href);
    }
  });

  it("marks itself as the current page in the nav", () => {
    render(<App />);
    expect(
      within(screen.getByRole("navigation", { name: "Primary" })).getByRole(
        "link",
        { name: "Home" },
      ),
    ).toHaveAttribute("aria-current", "page");
  });

  it("names every app and describes what it is", () => {
    render(<App />);
    for (const [name, tagline] of [
      ["CRM", "Personal sales CRM"],
      ["Space", "Personal knowledge manager"],
      ["Groove", "Browser groovebox"],
    ]) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
      expect(screen.getByText(tagline)).toBeInTheDocument();
    }
  });
});
