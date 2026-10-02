import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router";
import PageView from "./PageView";
import { api } from "../api";
import { pageData } from "../test/helpers";

vi.mock("../api", () => ({
  api: {
    getPage: vi.fn(),
    updatePage: vi.fn(),
    createBlock: vi.fn().mockResolvedValue({}),
    updateBlock: vi.fn().mockResolvedValue({}),
    deleteBlock: vi.fn().mockResolvedValue({ ok: true }),
    reorderBlocks: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

function renderPage(id = "p1", onTreeChange = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={[`/p/${id}`]}>
      <Routes>
        <Route
          path="/p/:pageId"
          element={<PageView onTreeChange={onTreeChange} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PageView", () => {
  it.each([false, true])(
    "keeps the current page when an earlier load settles late (failure: %s)",
    async (failure) => {
      let resolve!: (value: ReturnType<typeof pageData>) => void;
      let reject!: (reason: Error) => void;
      const earlier = new Promise<ReturnType<typeof pageData>>((ok, fail) => {
        resolve = ok;
        reject = fail;
      });
      vi.mocked(api.getPage).mockImplementation((id) =>
        id === "p1"
          ? earlier
          : Promise.resolve(pageData({ id: "p2", title: "Current page" })),
      );
      render(
        <MemoryRouter initialEntries={["/p/p1"]}>
          <Link to="/p/p2">Open current page</Link>
          <Routes>
            <Route
              path="/p/:pageId"
              element={<PageView onTreeChange={vi.fn()} />}
            />
          </Routes>
        </MemoryRouter>,
      );
      await userEvent.click(
        screen.getByRole("link", { name: "Open current page" }),
      );
      expect(
        await screen.findByDisplayValue("Current page"),
      ).toBeInTheDocument();
      await act(async () => {
        if (failure) reject(new Error("Earlier page unavailable"));
        else resolve(pageData({ id: "p1", title: "Earlier page" }));
        await earlier.catch(() => undefined);
      });
      expect(screen.getByDisplayValue("Current page")).toBeInTheDocument();
    },
  );

  it("loads and shows the page title and icon", async () => {
    vi.mocked(api.getPage).mockResolvedValue(
      pageData({ id: "p1", title: "Garden", icon: "🌱" }),
    );
    renderPage();
    expect(await screen.findByDisplayValue("Garden")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Change icon" }),
    ).toHaveTextContent("🌱");
  });

  it("autosaves title edits (debounced) and refreshes the tree", async () => {
    vi.mocked(api.getPage).mockResolvedValue(pageData({ id: "p1", title: "" }));
    vi.mocked(api.updatePage).mockResolvedValue(
      pageData({ id: "p1", title: "Hi" }),
    );
    const onTreeChange = vi.fn();
    renderPage("p1", onTreeChange);
    const input = await screen.findByPlaceholderText("Untitled");
    await userEvent.type(input, "Hi");
    expect(api.updatePage).not.toHaveBeenCalled();
    await waitFor(
      () => expect(api.updatePage).toHaveBeenCalledWith("p1", { title: "Hi" }),
      { timeout: 2000 },
    );
    await waitFor(() => expect(onTreeChange).toHaveBeenCalled());
  });

  it("changes the icon through the emoji picker", async () => {
    vi.mocked(api.getPage).mockResolvedValue(
      pageData({ id: "p1", title: "T" }),
    );
    vi.mocked(api.updatePage).mockResolvedValue(
      pageData({ id: "p1", title: "T", icon: "🚀" }),
    );
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: "Change icon" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Icon 🚀" }));
    expect(api.updatePage).toHaveBeenCalledWith("p1", { icon: "🚀" });
    expect(
      screen.getByRole("button", { name: "Change icon" }),
    ).toHaveTextContent("🚀");
  });

  it("removes the icon via the picker", async () => {
    vi.mocked(api.getPage).mockResolvedValue(
      pageData({ id: "p1", title: "T", icon: "🚀" }),
    );
    vi.mocked(api.updatePage).mockResolvedValue(
      pageData({ id: "p1", title: "T" }),
    );
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: "Change icon" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove icon" }));
    expect(api.updatePage).toHaveBeenCalledWith("p1", { icon: null });
  });

  it("shows a friendly message when the page is missing", async () => {
    vi.mocked(api.getPage).mockRejectedValue(new Error("page not found"));
    renderPage("gone");
    await waitFor(() =>
      expect(screen.getByText(/does not exist/)).toBeInTheDocument(),
    );
  });
});
