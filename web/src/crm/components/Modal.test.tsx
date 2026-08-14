import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Modal from "./Modal";

describe("Modal", () => {
  it("names the dialog with its title and shows its children", () => {
    render(
      <Modal title="Add deal" onClose={vi.fn()}>
        <p>Body</p>
      </Modal>,
    );
    expect(
      screen.getByRole("dialog", { name: "Add deal" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("closes on the overlay but not on the dialog itself", async () => {
    const onClose = vi.fn();
    render(
      <Modal title="Add deal" onClose={onClose}>
        <p>Body</p>
      </Modal>,
    );

    await userEvent.click(screen.getByText("Body"));
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("presentation"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
