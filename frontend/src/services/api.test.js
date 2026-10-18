import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, apiFetch, assetUrl } from "./api";
import { getAuth, setAuth } from "../auth";

function mockFetch(status, body, { json = true } = {}) {
  const res = {
    ok: status >= 200 && status < 300,
    status,
    json: json ? async () => body : async () => { throw new Error("not json"); },
    blob: async () => new Blob(["x"]),
  };
  const fn = vi.fn().mockResolvedValue(res);
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("apiFetch", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("sends the bearer token and returns parsed JSON", async () => {
    setAuth({ token: "tok", role: "user" });
    const f = mockFetch(200, [{ id: 1 }]);
    const data = await api.getCars();
    expect(data).toEqual([{ id: 1 }]);
    expect(f.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
  });

  it("parses the structured error shape into ApiError with field errors", async () => {
    mockFetch(422, { error: { code: "validation_error", message: "Bad", fields: { service_date: "Invalid date" } } });
    const err = await apiFetch("/x").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.code).toBe("validation_error");
    expect(err.fields.service_date).toBe("Invalid date");
  });

  it("falls back to legacy string detail", async () => {
    mockFetch(400, { detail: "Current password is incorrect" });
    const err = await apiFetch("/x").catch((e) => e);
    expect(err.message).toBe("Current password is incorrect");
  });

  it("clears the session on 401 for authenticated calls", async () => {
    setAuth({ token: "tok", role: "user" });
    mockFetch(401, { error: { code: "unauthorized", message: "Invalid or expired token" } });
    await expect(apiFetch("/me")).rejects.toMatchObject({ status: 401 });
    expect(getAuth().token).toBe("");
  });

  it("does not clear the session when an unauthenticated login fails", async () => {
    setAuth({ token: "tok", role: "user" });
    mockFetch(401, { detail: "Bad username or password" });
    await expect(api.login("a", "b")).rejects.toMatchObject({ status: 401 });
    expect(getAuth().token).toBe("tok");
  });

  it("flags a pending forced password change when the server demands it", async () => {
    setAuth({ token: "tok", role: "user" });
    mockFetch(403, { error: { code: "password_change_required", message: "You must set a new password" } });
    await expect(api.getCars()).rejects.toMatchObject({ status: 403, code: "password_change_required" });
    expect(getAuth().mustChangePassword).toBe(true);
    expect(getAuth().token).toBe("tok"); // still signed in, just gated
  });

  it("does not flag a password change for other 403 errors", async () => {
    setAuth({ token: "tok", role: "user" });
    mockFetch(403, { error: { code: "forbidden", message: "Forbidden" } });
    await expect(api.getCars()).rejects.toMatchObject({ status: 403 });
    expect(getAuth().mustChangePassword).toBe(false);
  });

  it("reports network failures as ApiError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fail")));
    const err = await apiFetch("/x").catch((e) => e);
    expect(err.code).toBe("network");
  });

  it("builds record filter query strings and skips empty values", async () => {
    const f = mockFetch(200, []);
    await api.getRecords(5, { q: "oil", type: "", year: 2026 });
    expect(f.mock.calls[0][0]).toMatch(/\/cars\/5\/records\?q=oil&year=2026$/);
  });
});

describe("assetUrl", () => {
  it("prefixes uploads with the API origin and leaves absolute urls alone", () => {
    expect(assetUrl("uploads/a.png")).toMatch(/\/uploads\/a\.png$/);
    expect(assetUrl("")).toBe("");
    expect(assetUrl("blob:abc")).toBe("blob:abc");
  });
});
