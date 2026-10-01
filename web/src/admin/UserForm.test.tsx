/** The add-user form: what it sends, and the error it surfaces. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserForm } from "./UserForm";
import { adminApi } from "./api";

vi.mock("./api", () => ({
  adminApi: {
    create: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the add-user form", () => {
  it("creates the user and clears the fields", async () => {
    vi.mocked(adminApi.create).mockResolvedValue({
      id: 2,
      email: "luca@example.com",
      role: "user",
      mustChangePassword: true,
    });
    const onCreated = vi.fn();
    render(<UserForm onCreated={onCreated} />);

    await userEvent.type(
      screen.getByLabelText("Email"),
      "  luca@example.com  ",
    );
    await userEvent.type(screen.getByLabelText("Temporary password"), "temp1");
    await userEvent.selectOptions(screen.getByLabelText("Role"), "admin");
    await userEvent.click(screen.getByRole("button", { name: "Add user" }));

    expect(adminApi.create).toHaveBeenCalledWith(
      "luca@example.com",
      "temp1",
      "admin",
    );
    expect(onCreated).toHaveBeenCalled();
    expect(screen.getByLabelText("Email")).toHaveValue("");
    expect(screen.getByLabelText("Temporary password")).toHaveValue("");
  });

  it("shows the server's message when the email is taken", async () => {
    vi.mocked(adminApi.create).mockRejectedValue(
      new Error("That email is taken"),
    );
    render(<UserForm onCreated={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Email"), "luca@example.com");
    await userEvent.type(screen.getByLabelText("Temporary password"), "temp1");
    await userEvent.click(screen.getByRole("button", { name: "Add user" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That email is taken",
    );
  });
});
