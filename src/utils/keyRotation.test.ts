/**
 * Key rotation: re-encrypts all E2EE blobs with a new key after password change.
 * Tests that runKeyRotation calls the API for each entity type when data is present.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runKeyRotation } from "./keyRotation";

describe("runKeyRotation", () => {
  const mockDecryptPayload = vi.fn(async (cipher: string) => {
    return JSON.parse(atob(cipher) || "{}");
  });
  const setEncryptionKey = vi.fn();
  const newPassword = "newPass";
  const salt = btoa(String.fromCharCode(...new Array(16).fill(0)));

  beforeEach(() => {
    vi.clearAllMocks();
    mockDecryptPayload.mockResolvedValue({ amountUsd: 100 });
  });

  it("calls setEncryptionKey with a key when no data exists", async () => {
    const api = vi.fn((path: string) => {
      if (path.startsWith("/expenses?")) return Promise.resolve([]);
      if (path === "/investments") return Promise.resolve([]);
      if (path.startsWith("/budgets?") && !path.includes("annual")) return Promise.resolve([]);
      return Promise.resolve({ rows: [], months: [] });
    });
    const progress = vi.fn();

    const result = await runKeyRotation(
      api as any,
      mockDecryptPayload as any,
      setEncryptionKey,
      newPassword,
      salt,
      progress
    );

    expect(result.ok).toBe(true);
    expect(setEncryptionKey).toHaveBeenCalledTimes(1);
    expect(setEncryptionKey.mock.calls[0][0]).toBeTruthy();
    expect(progress).toHaveBeenCalledWith("income");
    expect(progress).toHaveBeenCalledWith("expenses");
    expect(progress).toHaveBeenCalledWith("investments");
    expect(progress).toHaveBeenCalledWith("budgets");
    expect(progress).toHaveBeenCalledWith("templates");
    expect(progress).toHaveBeenCalledWith("planned");
    expect(progress).toHaveBeenCalledWith("other");
    expect(progress).toHaveBeenCalledWith("monthCloses");
  });

  it("re-encrypts income rows when present", async () => {
    const api = vi.fn((path: string, opts?: RequestInit) => {
      if (path.includes("/income?year=")) return Promise.resolve({ rows: [{ id: "i1", month: 1, encryptedPayload: btoa(JSON.stringify({ nominalUsd: 1000 })) }] });
      if (path === "/income" && opts?.method === "PATCH") return Promise.resolve({});
      if (path.startsWith("/expenses?")) return Promise.resolve([]);
      if (path === "/investments") return Promise.resolve([]);
      if (path.startsWith("/budgets?") && !path.includes("annual")) return Promise.resolve([]);
      return Promise.resolve({ rows: [], months: [] });
    });

    const result = await runKeyRotation(api as any, mockDecryptPayload as any, setEncryptionKey, newPassword, salt);

    expect(result.ok).toBe(true);
    expect(api).toHaveBeenCalledWith("/income", expect.objectContaining({ method: "PATCH", body: expect.any(String) }));
    const body = JSON.parse((api.mock.calls.find((c: any) => c[0] === "/income" && c[1]?.method === "PATCH") as any)[1].body);
    expect(body).toHaveProperty("encryptedPayload");
    expect(body.encryptedPayload).toBeTruthy();
  });
});
