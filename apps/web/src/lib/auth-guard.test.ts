import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

// Mock next/navigation
const mockRedirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`NEXT_REDIRECT: ${url}`);
  },
}));

// Mock the auth module
const mockGetSession = vi.fn();
vi.mock("./auth", () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

import { getSession, guardApi, requireSession } from "./auth-guard";

describe("auth-guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSession", () => {
    it("returns the session when authenticated", async () => {
      const session = { user: { id: "1", role: "reviewer" } };
      mockGetSession.mockResolvedValue(session);

      const result = await getSession();
      expect(result).toEqual(session);
    });

    it("returns null when not authenticated", async () => {
      mockGetSession.mockResolvedValue(null);

      const result = await getSession();
      expect(result).toBeNull();
    });
  });

  describe("requireSession", () => {
    it("returns the session when authenticated", async () => {
      const session = { user: { id: "1", role: "admin" } };
      mockGetSession.mockResolvedValue(session);

      const result = await requireSession();
      expect(result).toEqual(session);
    });

    it("redirects to /login when not authenticated", async () => {
      mockGetSession.mockResolvedValue(null);

      await expect(requireSession()).rejects.toThrow("NEXT_REDIRECT");
      expect(mockRedirect).toHaveBeenCalledWith("/login");
    });
  });

  describe("guardApi", () => {
    it("returns session when authenticated with no role requirement", async () => {
      const session = { user: { id: "1", role: "reviewer" } };
      mockGetSession.mockResolvedValue(session);

      const result = await guardApi();
      expect(result).toEqual({ session });
    });

    it("returns 401 error when not authenticated", async () => {
      mockGetSession.mockResolvedValue(null);

      const result = await guardApi();
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.status).toBe(401);
      }
    });

    it("allows admin to access any role-restricted route", async () => {
      const session = { user: { id: "1", role: "admin" } };
      mockGetSession.mockResolvedValue(session);

      const result = await guardApi({ role: "reviewer" });
      expect(result).toEqual({ session });
    });

    it("returns 403 when user lacks the required role", async () => {
      const session = { user: { id: "1", role: "reviewer" } };
      mockGetSession.mockResolvedValue(session);

      const result = await guardApi({ role: "admin" });
      expect("error" in result).toBe(true);
      if ("error" in result) {
        expect(result.error.status).toBe(403);
      }
    });
  });
});
