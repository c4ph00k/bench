/** The users endpoint helper: paths, bodies, and the 401 that means the session is gone. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminApi } from "./api";
import { redirectTo } from "../shared/auth";

vi.mock("../shared/auth", () => ({
  redirectTo: vi.fn(),
}));

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown) {
  return {
    status,
    ok: status < 400,
    json: () => Promise.resolve(body),
  } as Response;
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

describe("adminApi", () => {
  it("lists users", async () => {
    const users = [
      { id: 1, username: "marco", role: "admin", mustChangePassword: false },
    ];
    fetchMock.mockResolvedValue(jsonResponse(200, users));
    await expect(adminApi.list()).resolves.toEqual(users);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/users",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("sends create and reset bodies", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(201, {
          id: 2,
          username: "luca",
          role: "user",
          mustChangePassword: true,
        }),
      )
      .mockResolvedValueOnce(jsonResponse(204, {}));
    await adminApi.create("luca", "temp1", "user");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/auth/users",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          username: "luca",
          password: "temp1",
          role: "user",
        }),
      }),
    );
    await adminApi.resetPassword(2, "temp2");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/auth/users/2/reset-password",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ password: "temp2" }),
      }),
    );
  });

  it("leads to the login document on a 401", async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: "Not signed in" }));
    await expect(adminApi.list()).rejects.toThrow();
    expect(redirectTo).toHaveBeenCalledWith("/login");
  });

  it("raises the server's message on a refusal", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, { error: "The last admin cannot be demoted" }),
    );
    await expect(adminApi.update(1, { role: "user" })).rejects.toThrow(
      "The last admin cannot be demoted",
    );
  });
});
