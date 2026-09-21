import { guardApi } from "@/lib/auth-guard";
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
import { reviewStatusSchema, severitySchema } from "@caduward/shared";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const guard = await guardApi();
  if ("error" in guard) return guard.error;

  const url = request.nextUrl;
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "25")));
  const offset = (page - 1) * limit;

  const severityFilter = url.searchParams.get("severity");
  const statusFilter = url.searchParams.get("status");

  const conditions: SQL[] = [];
  if (severityFilter) {
    const parsed = severitySchema.safeParse(severityFilter);
    if (parsed.success) {
      conditions.push(eq(anomalyFlags.severity, parsed.data));
    }
  }
  if (statusFilter) {
    const parsed = reviewStatusSchema.safeParse(statusFilter);
    if (parsed.success) {
      conditions.push(eq(anomalyFlags.reviewStatus, parsed.data));
    }
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const severityOrder = sql`CASE ${anomalyFlags.severity}
    WHEN 'critical' THEN 0
    WHEN 'high' THEN 1
    WHEN 'medium' THEN 2
    WHEN 'low' THEN 3
  END`;

  const [flags, countResult] = await Promise.all([
    db
      .select({
        id: anomalyFlags.id,
        severity: anomalyFlags.severity,
        triggeredRules: anomalyFlags.triggeredRules,
        reviewStatus: anomalyFlags.reviewStatus,
        similarityScore: anomalyFlags.similarityScore,
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
      .orderBy(severityOrder, desc(anomalyFlags.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(anomalyFlags).where(where),
  ]);

  return Response.json({
    data: flags,
    pagination: {
      page,
      limit,
      total: countResult[0]?.count ?? 0,
      totalPages: Math.ceil((countResult[0]?.count ?? 0) / limit),
    },
  });
}
