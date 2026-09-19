import {
  type SQL,
  accessEvents,
  and,
  anomalyFlags,
  db,
  desc,
  eq,
  flagExplanations,
  patients,
  sql,
  staff,
} from "@caduward/db";
import type { ReviewStatus, Severity } from "@caduward/shared";
import Link from "next/link";
import { FilterBar } from "./filter-bar";
import { LiveFlags } from "./live-flags";

const SEVERITY_ORDER = sql`CASE ${anomalyFlags.severity}
  WHEN 'critical' THEN 0
  WHEN 'high' THEN 1
  WHEN 'medium' THEN 2
  WHEN 'low' THEN 3
END`;

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#ca8a04",
  low: "#16a34a",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#2563eb",
  reviewed: "#16a34a",
  escalated: "#dc2626",
  dismissed: "#6b7280",
};

interface Props {
  searchParams: Promise<{ severity?: string; status?: string; page?: string }>;
}

export default async function DashboardPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? "1"));
  const limit = 25;
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];
  if (params.severity) {
    conditions.push(eq(anomalyFlags.severity, params.severity as Severity));
  }
  if (params.status) {
    conditions.push(eq(anomalyFlags.reviewStatus, params.status as ReviewStatus));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [flags, countResult] = await Promise.all([
    db
      .select({
        id: anomalyFlags.id,
        severity: anomalyFlags.severity,
        triggeredRules: anomalyFlags.triggeredRules,
        reviewStatus: anomalyFlags.reviewStatus,
        createdAt: anomalyFlags.createdAt,
        summary: flagExplanations.summary,
        staffName: sql<string>`${staff.firstName} || ' ' || ${staff.lastName}`,
        staffRole: staff.role,
        staffDepartment: staff.department,
        patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        accessTimestamp: accessEvents.timestamp,
        accessType: accessEvents.accessType,
      })
      .from(anomalyFlags)
      .leftJoin(flagExplanations, eq(flagExplanations.flagId, anomalyFlags.id))
      .innerJoin(accessEvents, eq(accessEvents.id, anomalyFlags.accessEventId))
      .innerJoin(staff, eq(staff.id, accessEvents.staffId))
      .innerJoin(patients, eq(patients.id, accessEvents.patientId))
      .where(where)
      .orderBy(SEVERITY_ORDER, desc(anomalyFlags.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(anomalyFlags).where(where),
  ]);

  const total = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Anomaly Flags</h1>
        <span style={{ fontSize: 14, color: "#666" }}>{total} total flags</span>
      </div>

      <LiveFlags />

      <FilterBar currentSeverity={params.severity} currentStatus={params.status} />

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600 }}>Severity</th>
              <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600 }}>Status</th>
              <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600 }}>Staff</th>
              <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600 }}>Patient</th>
              <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600 }}>Rules</th>
              <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600 }}>Summary</th>
              <th style={{ textAlign: "left", padding: "10px 12px", fontWeight: 600 }}>Time</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((flag) => (
              <tr key={flag.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                <td style={{ padding: "10px 12px" }}>
                  <span
                    style={{
                      color: SEVERITY_COLORS[flag.severity] ?? "#111",
                      fontWeight: 600,
                      fontSize: 12,
                      textTransform: "uppercase",
                    }}
                  >
                    {flag.severity}
                  </span>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <span
                    style={{
                      color: STATUS_COLORS[flag.reviewStatus] ?? "#111",
                      fontSize: 12,
                    }}
                  >
                    {flag.reviewStatus}
                  </span>
                </td>
                <td style={{ padding: "10px 12px" }}>
                  <div>{flag.staffName}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>
                    {flag.staffRole} — {flag.staffDepartment}
                  </div>
                </td>
                <td style={{ padding: "10px 12px" }}>{flag.patientName}</td>
                <td style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {flag.triggeredRules.map((rule) => (
                      <span
                        key={rule}
                        style={{
                          fontSize: 11,
                          background: "#f3f4f6",
                          padding: "2px 6px",
                          borderRadius: 3,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {rule}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: "10px 12px", maxWidth: 300 }}>
                  <Link
                    href={`/dashboard/flags/${flag.id}`}
                    style={{ color: "#2563eb", textDecoration: "none" }}
                  >
                    {flag.summary
                      ? flag.summary.length > 100
                        ? `${flag.summary.slice(0, 100)}...`
                        : flag.summary
                      : "View details"}
                  </Link>
                </td>
                <td
                  style={{
                    padding: "10px 12px",
                    whiteSpace: "nowrap",
                    fontSize: 12,
                    color: "#666",
                  }}
                >
                  {flag.accessTimestamp
                    ? new Date(flag.accessTimestamp).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "—"}
                </td>
              </tr>
            ))}
            {flags.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#666" }}>
                  No flags found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          {page > 1 && (
            <Link
              href={`/dashboard?page=${page - 1}${params.severity ? `&severity=${params.severity}` : ""}${params.status ? `&status=${params.status}` : ""}`}
              style={{
                padding: "6px 12px",
                border: "1px solid #ddd",
                borderRadius: 4,
                textDecoration: "none",
                color: "#111",
              }}
            >
              Previous
            </Link>
          )}
          <span style={{ padding: "6px 12px", fontSize: 14, color: "#666" }}>
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/dashboard?page=${page + 1}${params.severity ? `&severity=${params.severity}` : ""}${params.status ? `&status=${params.status}` : ""}`}
              style={{
                padding: "6px 12px",
                border: "1px solid #ddd",
                borderRadius: 4,
                textDecoration: "none",
                color: "#111",
              }}
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
