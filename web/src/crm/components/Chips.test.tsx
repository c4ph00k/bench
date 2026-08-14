import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StageChip, StatusChip } from "./Chips";

describe("chips", () => {
  it("names the status and carries its class, which is what colours it", () => {
    render(<StatusChip status="customer" />);
    const chip = screen.getByText("customer");
    expect(chip).toHaveClass("chip", "chip-customer");
  });

  it("names the stage and carries its class", () => {
    render(<StageChip stage="Negotiation" />);
    expect(screen.getByText("Negotiation")).toHaveClass(
      "chip",
      "stage-Negotiation",
    );
  });
});
