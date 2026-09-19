import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies
vi.mock("node:http", () => ({
  createServer: vi.fn(() => ({
    listen: vi.fn((_port: number, cb: () => void) => cb()),
  })),
}));

const mockEmit = vi.fn();
vi.mock("socket.io", () => ({
  Server: vi.fn(() => ({
    adapter: vi.fn(),
    emit: mockEmit,
  })),
}));

vi.mock("redis", () => ({
  createClient: vi.fn(() => ({
    connect: vi.fn(),
    duplicate: vi.fn(() => ({ connect: vi.fn() })),
  })),
}));

vi.mock("@socket.io/redis-adapter", () => ({
  createAdapter: vi.fn(),
}));

import type { FlagEvent } from "./socket.js";

describe("socket module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts the socket server and allows emitting flag events", async () => {
    // Dynamic import after mocks are set up
    const { startSocketServer, emitNewFlag } = await import("./socket.js");

    await startSocketServer();

    const flag: FlagEvent = {
      id: "flag-1",
      severity: "high",
      triggeredRules: ["off_shift"],
      summary: "Staff accessed record outside shift hours",
      createdAt: "2026-09-19T10:00:00Z",
    };

    emitNewFlag(flag);

    expect(mockEmit).toHaveBeenCalledWith("flag:new", flag);
  });

  it("does not emit when server has not started", async () => {
    // Fresh import with reset modules to get a clean io=null state
    vi.resetModules();

    // Re-apply mocks after reset
    vi.doMock("node:http", () => ({
      createServer: vi.fn(() => ({
        listen: vi.fn((_port: number, cb: () => void) => cb()),
      })),
    }));
    vi.doMock("socket.io", () => ({
      Server: vi.fn(() => ({
        adapter: vi.fn(),
        emit: mockEmit,
      })),
    }));
    vi.doMock("redis", () => ({
      createClient: vi.fn(() => ({
        connect: vi.fn(),
        duplicate: vi.fn(() => ({ connect: vi.fn() })),
      })),
    }));
    vi.doMock("@socket.io/redis-adapter", () => ({
      createAdapter: vi.fn(),
    }));

    const { emitNewFlag } = await import("./socket.js");

    // Should not throw when io is null
    emitNewFlag({
      id: "flag-2",
      severity: "low",
      triggeredRules: ["vip_access"],
      summary: null,
      createdAt: "2026-09-19T10:00:00Z",
    });

    // mockEmit should not have been called since server wasn't started
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
