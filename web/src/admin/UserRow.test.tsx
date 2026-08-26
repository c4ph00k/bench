/** One user row: the role select, the reset-password flow and the two-step delete. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserRow } from "./UserRow";
import { adminApi, type PublicUser } from "./api";

vi.mock("./api", () => ({
  adminApi: {
    update: vi.fn(),
    resetPassword: vi.fn(),
    remove: vi.fn(),
  },
}));

const user: PublicUser = {
  id: 2,
  username: "luca",
  role: "user",
  mustChangePassword: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("a user row", () => {
  it("changes the role from the select", async () => {
    vi.mocked(adminApi.update).mockResolvedValue({ ...user, role: "admin" });
    const onChanged = vi.fn();
    render(<UserRow user={user} onChanged={onChanged} />);

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Role for luca" }),
      "admin",
    );

    expect(adminApi.update).toHaveBeenCalledWith(2, { role: "admin" });
    expect(onChanged).toHaveBeenCalled();
  });

  it("shows the flag for a temporary password", () => {
    render(<UserRow user={user} onChanged={vi.fn()} />);
    expect(screen.getByText("Temporary password")).toBeInTheDocument();
  });

  it("offers no delete button for the seeded admin", () => {
    render(
      <UserRow
        user={{
          id: 1,
          username: "marco",
          role: "admin",
          mustChangePassword: false,
        }}
        onChanged={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument();
  });

  it("resets the password through the inline form", async () => {
    vi.mocked(adminApi.resetPassword).mockResolvedValue(undefined);
    const onChanged = vi.fn();
    render(<UserRow user={user} onChanged={onChanged} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Reset password" }),
    );
    await userEvent.type(
      screen.getByLabelText("New temporary password"),
      "temp2",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Set temporary password" }),
    );

    expect(adminApi.resetPassword).toHaveBeenCalledWith(2, "temp2");
    expect(onChanged).toHaveBeenCalled();
  });

  it("deletes only after confirmation", async () => {
    vi.mocked(adminApi.remove).mockResolvedValue(undefined);
    const onChanged = vi.fn();
    render(<UserRow user={user} onChanged={onChanged} />);

    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(adminApi.remove).not.toHaveBeenCalled();
    await userEvent.click(
      screen.getByRole("button", { name: "Confirm delete" }),
    );
    expect(adminApi.remove).toHaveBeenCalledWith(2);
    expect(onChanged).toHaveBeenCalled();
  });

  it("surfaces the server's refusal", async () => {
    vi.mocked(adminApi.update).mockRejectedValue(
      new Error("The last admin cannot be demoted"),
    );
    render(<UserRow user={user} onChanged={vi.fn()} />);

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Role for luca" }),
      "admin",
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The last admin cannot be demoted",
    );
  });
});
