import { guardApi } from "@/lib/auth-guard";
import {
  accessEvents,
  anomalyFlags,
  db,
  encounters,
  eq,
  flagExplanations,
  patients,
  sql,
  staff,
} from "@caduward/db";
import type { NextRequest } from "next/server";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await guardApi();
  if ("error" in guard) return guard.error;

  const { id } = await params;

  const rows = await db
    .select({
      id: anomalyFlags.id,
      severity: anomalyFlags.severity,
      triggeredRules: anomalyFlags.triggeredRules,
      reviewStatus: anomalyFlags.reviewStatus,
      similarityScore: anomalyFlags.similarityScore,
      createdAt: anomalyFlags.createdAt,
      explanation: {
        summary: flagExplanations.summary,
        contributingFactors: flagExplanations.contributingFactors,
        recommendedAction: flagExplanations.recommendedAction,
      },
      accessEvent: {
        id: accessEvents.id,
        timestamp: accessEvents.timestamp,
        accessType: accessEvents.accessType,
      },
      staff: {
        id: staff.id,
        name: sql<string>`${staff.firstName} || ' ' || ${staff.lastName}`,
        role: staff.role,
        department: staff.department,
        shiftStart: staff.shiftStart,
        shiftEnd: staff.shiftEnd,
      },
      patient: {
        id: patients.id,
        name: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
        isVip: patients.isVip,
      },
      encounter: {
        id: encounters.id,
        department: encounters.department,
        scheduledStart: encounters.scheduledStart,
        scheduledEnd: encounters.scheduledEnd,
      },
    })
    .from(anomalyFlags)
    .leftJoin(flagExplanations, eq(flagExplanations.flagId, anomalyFlags.id))
    .innerJoin(accessEvents, eq(accessEvents.id, anomalyFlags.accessEventId))
    .innerJoin(staff, eq(staff.id, accessEvents.staffId))
    .innerJoin(patients, eq(patients.id, accessEvents.patientId))
    .leftJoin(encounters, eq(encounters.id, accessEvents.linkedEncounterId))
    .where(eq(anomalyFlags.id, id))
    .limit(1);

  if (rows.length === 0) {
    return Response.json({ error: "Flag not found" }, { status: 404 });
  }

  return Response.json({ data: rows[0] });
}
