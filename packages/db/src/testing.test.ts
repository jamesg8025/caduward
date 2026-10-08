import { describe, expect, it } from "vitest";
import { DEFAULT_DATABASE_URL } from "./config";
import {
  DEFAULT_TEST_DATABASE_URL,
  assertSafeTestDatabaseUrl,
  databaseName,
  resolveTestDatabaseUrl,
} from "./testing";

describe("testing", () => {
  describe("databaseName", () => {
    it("extracts the database name from a connection URL", () => {
      expect(databaseName("postgresql://u:p@localhost:5433/caduward_test")).toBe("caduward_test");
    });
  });

  describe("assertSafeTestDatabaseUrl", () => {
    it("accepts a *_test database that differs from the dev database", () => {
      expect(() =>
        assertSafeTestDatabaseUrl(DEFAULT_TEST_DATABASE_URL, DEFAULT_DATABASE_URL),
      ).not.toThrow();
    });

    it("rejects a database whose name does not end in _test", () => {
      expect(() =>
        assertSafeTestDatabaseUrl("postgresql://u:p@localhost:5433/caduward", DEFAULT_DATABASE_URL),
      ).toThrow(/must end in "_test"/);
    });

    it("rejects a test URL that points at the dev database", () => {
      const devUrl = "postgresql://u:p@localhost:5433/shared_test";
      expect(() =>
        assertSafeTestDatabaseUrl("postgresql://other:pw@localhost:5433/shared_test", devUrl),
      ).toThrow(/dev database/);
    });

    it("treats a missing port as the Postgres default when comparing", () => {
      expect(() =>
        assertSafeTestDatabaseUrl(
          "postgresql://u:p@db:5432/app_test",
          "postgresql://u:p@db/app_test",
        ),
      ).toThrow(/dev database/);
    });
  });

  describe("resolveTestDatabaseUrl", () => {
    it("defaults to the caduward_test database", () => {
      expect(resolveTestDatabaseUrl({})).toBe(DEFAULT_TEST_DATABASE_URL);
    });

    it("uses CADUWARD_TEST_DATABASE_URL when set", () => {
      const url = "postgresql://u:p@localhost:5433/custom_test";
      expect(resolveTestDatabaseUrl({ CADUWARD_TEST_DATABASE_URL: url })).toBe(url);
    });

    it("throws when CADUWARD_TEST_DATABASE_URL is the same as CADUWARD_DATABASE_URL", () => {
      const url = "postgresql://u:p@localhost:5433/caduward";
      expect(() =>
        resolveTestDatabaseUrl({ CADUWARD_TEST_DATABASE_URL: url, CADUWARD_DATABASE_URL: url }),
      ).toThrow();
    });
  });
});
