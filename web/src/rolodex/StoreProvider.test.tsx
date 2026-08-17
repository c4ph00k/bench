import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StoreProvider from "./StoreProvider";
import { api } from "./api";
import { useStore, useToast } from "./store";
import { person } from "./test/helpers";

vi.mock("./api");

/** A stand-in page: it shows what the store holds and can ask it to do things. */
function Probe() {
  const { people, tags, loaded, refresh } = useStore();
  const toast = useToast();
  return (
    <div>
      <p>
        {loaded ? `${people.length} people, ${tags.length} tags` : "loading"}
      </p>
      <button onClick={() => void refresh()}>Refresh</button>
      <button onClick={() => toast("Saved that")}>Say something</button>
    </div>
  );
}

const renderStore = () =>
  render(
    <StoreProvider>
      <Probe />
    </StoreProvider>,
  );

describe("StoreProvider", () => {
  it("loads the people and their tags once, for every page to share", async () => {
    vi.mocked(api.listPeople).mockResolvedValue([person(), person({ id: 2 })]);
    vi.mocked(api.tags).mockResolvedValue(["design"]);
    renderStore();

    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(await screen.findByText("2 people, 1 tags")).toBeInTheDocument();
    expect(api.listPeople).toHaveBeenCalledTimes(1);
  });

  it("re-reads them when a page says something changed", async () => {
    vi.mocked(api.listPeople).mockResolvedValue([person()]);
    vi.mocked(api.tags).mockResolvedValue([]);
    renderStore();
    await screen.findByText("1 people, 0 tags");

    vi.mocked(api.listPeople).mockResolvedValue([person(), person({ id: 2 })]);
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText("2 people, 0 tags")).toBeInTheDocument();
  });

  it("shows a toast, then takes it away again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(api.listPeople).mockResolvedValue([]);
    vi.mocked(api.tags).mockResolvedValue([]);
    renderStore();
    await screen.findByText("0 people, 0 tags");

    await userEvent.click(
      screen.getByRole("button", { name: "Say something" }),
    );
    expect(screen.getByText("Saved that")).toBeInTheDocument();

    vi.advanceTimersByTime(3300);
    await waitFor(() => {
      expect(screen.queryByText("Saved that")).not.toBeInTheDocument();
    });
    vi.useRealTimers();
  });
});
