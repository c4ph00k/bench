import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("launcher", () => {
  it("links each app at its own document root", () => {
    render(<App />);
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/crm/",
      "/space/",
      "/groove/",
    ]);
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
