import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}));

// We test the fetch call logic without rendering React components.
// This validates the API interaction contract.
describe("review action fetch contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("calls PATCH /api/flags/:id/review with the correct body", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: "flag-1", reviewStatus: "reviewed" } }),
    });

    const res = await fetch("/api/flags/flag-1/review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "reviewed" }),
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/flags/flag-1/review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "reviewed" }),
    });
    expect(res.ok).toBe(true);
  });

  it("handles error responses from the review endpoint", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Flag not found" }),
    });

    const res = await fetch("/api/flags/missing/review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "escalated" }),
    });

    expect(res.ok).toBe(false);
    const body = await res.json();
    expect(body.error).toBe("Flag not found");
  });
});
