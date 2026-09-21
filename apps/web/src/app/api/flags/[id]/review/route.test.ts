import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth guard
const mockGuardApi = vi.fn();
vi.mock("@/lib/auth-guard", () => ({
  guardApi: (...args: unknown[]) => mockGuardApi(...args),
}));

// Mock DB
const mockUpdate = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockReturning = vi.fn();

const updateChain = {
  set: mockSet.mockReturnThis(),
  where: mockWhere.mockReturnThis(),
  returning: mockReturning,
};

vi.mock("@caduward/db", () => ({
  db: {
    update: (...args: unknown[]) => {
      mockUpdate(...args);
      return updateChain;
    },
  },
  anomalyFlags: { id: "id", reviewStatus: "review_status" },
  eq: vi.fn(),
}));

import { NextRequest } from "next/server";
import { PATCH } from "./route";

function makeRequest(body: unknown) {
  return new NextRequest(new URL("http://localhost:3000/api/flags/flag-1/review"), {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const params = Promise.resolve({ id: "flag-1" });

describe("PATCH /api/flags/:id/review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSet.mockReturnValue(updateChain);
    mockWhere.mockReturnValue(updateChain);
  });

  it("returns 401 when not authenticated", async () => {
    mockGuardApi.mockResolvedValue({
      error: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await PATCH(makeRequest({ status: "reviewed" }), { params });
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid status values", async () => {
    mockGuardApi.mockResolvedValue({
      session: { user: { id: "1", role: "reviewer" } },
    });

    const response = await PATCH(makeRequest({ status: "invalid" }), { params });
    expect(response.status).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Invalid request body");
  });

  it("returns 400 when trying to set status back to open", async () => {
    mockGuardApi.mockResolvedValue({
      session: { user: { id: "1", role: "reviewer" } },
    });

    const response = await PATCH(makeRequest({ status: "open" }), { params });
    expect(response.status).toBe(400);
  });

  it("returns 404 when flag does not exist", async () => {
    mockGuardApi.mockResolvedValue({
      session: { user: { id: "1", role: "reviewer" } },
    });
    mockReturning.mockResolvedValue([]);

    const response = await PATCH(makeRequest({ status: "reviewed" }), { params });
    expect(response.status).toBe(404);
  });

  it("updates review status and returns the updated flag", async () => {
    mockGuardApi.mockResolvedValue({
      session: { user: { id: "1", role: "reviewer" } },
    });
    mockReturning.mockResolvedValue([{ id: "flag-1", reviewStatus: "reviewed" }]);

    const response = await PATCH(makeRequest({ status: "reviewed" }), { params });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data).toEqual({ id: "flag-1", reviewStatus: "reviewed" });
  });
});
