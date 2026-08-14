import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useFetch } from "./hooks";
import { api } from "./api";

vi.mock("./api", () => ({ api: { get: vi.fn() } }));

afterEach(() => {
  vi.clearAllMocks();
});

function Probe({ url }: { url: string | null }) {
  const { data, reload } = useFetch<{ name: string }>(url);
  return (
    <>
      <span data-testid="name">{data?.name ?? "loading"}</span>
      <button onClick={reload}>Reload</button>
    </>
  );
}

const name = () => screen.getByTestId("name").textContent;

describe("useFetch", () => {
  it("fetches the url and hands back what came out", async () => {
    vi.mocked(api.get).mockResolvedValue({ name: "Bluepeak" });
    render(<Probe url="/api/crm/organizations/1" />);

    expect(name()).toBe("loading");
    expect(await screen.findByText("Bluepeak")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/api/crm/organizations/1");
  });

  it("fetches nothing while the url is null", () => {
    render(<Probe url={null} />);
    expect(api.get).not.toHaveBeenCalled();
    expect(name()).toBe("loading");
  });

  it("refetches when the url changes", async () => {
    vi.mocked(api.get).mockResolvedValue({ name: "Bluepeak" });
    const { rerender } = render(<Probe url="/api/crm/organizations/1" />);
    await screen.findByText("Bluepeak");

    vi.mocked(api.get).mockResolvedValue({ name: "Alderway" });
    rerender(<Probe url="/api/crm/organizations/2" />);
    expect(await screen.findByText("Alderway")).toBeInTheDocument();
  });

  it("refetches the same url when reload is called", async () => {
    vi.mocked(api.get).mockResolvedValue({ name: "Bluepeak" });
    render(<Probe url="/api/crm/organizations/1" />);
    await screen.findByText("Bluepeak");

    vi.mocked(api.get).mockResolvedValue({ name: "Bluepeak Ltd" });
    await userEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(await screen.findByText("Bluepeak Ltd")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it("drops a reply that arrives after the url moved on", async () => {
    let settleFirst!: (value: { name: string }) => void;
    vi.mocked(api.get).mockReturnValueOnce(
      new Promise<{ name: string }>((resolve) => {
        settleFirst = resolve;
      }),
    );
    const { rerender } = render(<Probe url="/api/crm/organizations/1" />);

    vi.mocked(api.get).mockResolvedValue({ name: "Alderway" });
    rerender(<Probe url="/api/crm/organizations/2" />);
    await screen.findByText("Alderway");

    await act(async () => {
      settleFirst({ name: "Bluepeak" });
      await Promise.resolve();
    });
    expect(name()).toBe("Alderway");
  });
});
