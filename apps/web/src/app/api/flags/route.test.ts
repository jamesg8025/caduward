import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock auth guard
const mockGuardApi = vi.fn();
vi.mock("@/lib/auth-guard", () => ({
  guardApi: (...args: unknown[]) => mockGuardApi(...args),
}));

// Build a chainable mock that returns itself for every method call,
// and resolves to a configurable value when awaited (via .then())
function createQueryChain(resolveValue: unknown = []) {
  const chain: Record<string, unknown> = {};
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(resolveValue);
      }
      return (..._args: unknown[]) => new Proxy({}, handler);
    },
  };
  return new Proxy(chain, handler);
}

let selectCallIndex = 0;
let selectResults: unknown[][] = [];

vi.mock("@caduward/db", () => ({
  db: {
    select: () => {
      const result = selectResults[selectCallIndex] ?? [];
      selectCallIndex++;
      return createQueryChain(result);
    },
  },
  anomalyFlags: {
    id: "id",
    severity: "severity",
    reviewStatus: "review_status",
    accessEventId: "access_event_id",
    triggeredRules: "triggered_rules",
    similarityScore: "similarity_score",
    createdAt: "created_at",
  },
  flagExplanations: { flagId: "flag_id", summary: "summary" },
  accessEvents: {
    id: "id",
    staffId: "staff_id",
    patientId: "patient_id",
    timestamp: "timestamp",
    accessType: "access_type",
  },
  staff: {
    id: "id",
    firstName: "first_name",
    lastName: "last_name",
    role: "role",
    department: "department",
  },
  patients: { id: "id", firstName: "first_name", lastName: "last_name" },
  desc: vi.fn(),
  eq: vi.fn(),
  sql: vi.fn(() => ""),
  and: vi.fn(),
  SQL: class {},
}));

vi.mock("@caduward/shared", () => ({
  severitySchema: { safeParse: vi.fn().mockReturnValue({ success: false }) },
  reviewStatusSchema: { safeParse: vi.fn().mockReturnValue({ success: false }) },
}));

import { NextRequest } from "next/server";
import { GET } from "./route";

function makeRequest(url = "http://localhost:3000/api/flags") {
  return new NextRequest(new URL(url));
}

describe("GET /api/flags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectCallIndex = 0;
    selectResults = [];
  });

  it("returns 401 when not authenticated", async () => {
    mockGuardApi.mockResolvedValue({
      error: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(makeRequest());
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("returns paginated flag list when authenticated", async () => {
    mockGuardApi.mockResolvedValue({
      session: { user: { id: "1", role: "reviewer" } },
    });

    const flags = [{ id: "flag-1", severity: "high" }];
    // First select: flag list, second select: count
    selectResults = [flags, [{ count: 1 }]];

    const response = await GET(makeRequest());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.data).toEqual(flags);
    expect(body.pagination).toMatchObject({
      page: 1,
      limit: 25,
      total: 1,
    });
  });
});
