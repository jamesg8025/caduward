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
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewActions } from "./review-actions";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#ca8a04",
  low: "#16a34a",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FlagDetailPage({ params }: Props) {
  const { id } = await params;

  const rows = await db
    .select({
      id: anomalyFlags.id,
      severity: anomalyFlags.severity,
      triggeredRules: anomalyFlags.triggeredRules,
      reviewStatus: anomalyFlags.reviewStatus,
      similarityScore: anomalyFlags.similarityScore,
      createdAt: anomalyFlags.createdAt,
      summary: flagExplanations.summary,
      contributingFactors: flagExplanations.contributingFactors,
      recommendedAction: flagExplanations.recommendedAction,
      staffId: staff.id,
      staffName: sql<string>`${staff.firstName} || ' ' || ${staff.lastName}`,
      staffRole: staff.role,
      staffDepartment: staff.department,
      shiftStart: staff.shiftStart,
      shiftEnd: staff.shiftEnd,
      patientId: patients.id,
      patientName: sql<string>`${patients.firstName} || ' ' || ${patients.lastName}`,
      patientIsVip: patients.isVip,
      accessTimestamp: accessEvents.timestamp,
      accessType: accessEvents.accessType,
      encounterId: encounters.id,
      encounterDepartment: encounters.department,
      encounterStart: encounters.scheduledStart,
      encounterEnd: encounters.scheduledEnd,
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
    notFound();
  }

  const flag = rows[0];

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <Link href="/dashboard" style={{ color: "#2563eb", textDecoration: "none", fontSize: 14 }}>
        &larr; Back to flags
      </Link>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginTop: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: "0 0 8px" }}>Flag Detail</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span
              style={{
                color: SEVERITY_COLORS[flag.severity] ?? "#111",
                fontWeight: 700,
                fontSize: 13,
                textTransform: "uppercase",
                background: "#f9fafb",
                padding: "2px 8px",
                borderRadius: 4,
              }}
            >
              {flag.severity}
            </span>
            {flag.triggeredRules.map((rule) => (
              <span
                key={rule}
                style={{
                  fontSize: 12,
                  background: "#f3f4f6",
                  padding: "2px 8px",
                  borderRadius: 4,
                }}
              >
                {rule}
              </span>
            ))}
          </div>
        </div>
        <ReviewActions flagId={flag.id} currentStatus={flag.reviewStatus} />
      </div>

      {/* Explanation */}
      {flag.summary && (
        <Section title="Explanation">
          <p style={{ margin: "0 0 12px", lineHeight: 1.6 }}>{flag.summary}</p>
          {flag.contributingFactors && flag.contributingFactors.length > 0 && (
            <>
              <h4 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 8px" }}>
                Contributing Factors
              </h4>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {flag.contributingFactors.map((factor) => (
                  <li key={factor} style={{ marginBottom: 4, lineHeight: 1.5 }}>
                    {factor}
                  </li>
                ))}
              </ul>
            </>
          )}
          {flag.recommendedAction && (
            <>
              <h4 style={{ fontSize: 14, fontWeight: 600, margin: "16px 0 8px" }}>
                Recommended Action
              </h4>
              <p style={{ margin: 0, lineHeight: 1.6 }}>{flag.recommendedAction}</p>
            </>
          )}
        </Section>
      )}

      {/* Access Event */}
      <Section title="Access Event">
        <DetailRow
          label="Time"
          value={flag.accessTimestamp ? new Date(flag.accessTimestamp).toLocaleString() : "—"}
        />
        <DetailRow label="Access Type" value={flag.accessType} />
        {flag.similarityScore != null && (
          <DetailRow label="Similarity Score" value={flag.similarityScore.toFixed(4)} />
        )}
      </Section>

      {/* Staff */}
      <Section title="Staff Member">
        <DetailRow label="Name" value={flag.staffName} />
        <DetailRow label="Role" value={flag.staffRole} />
        <DetailRow label="Department" value={flag.staffDepartment} />
        <DetailRow label="Shift" value={`${flag.shiftStart} – ${flag.shiftEnd}`} />
      </Section>

      {/* Patient */}
      <Section title="Patient">
        <DetailRow label="Name" value={flag.patientName} />
        <DetailRow label="VIP" value={flag.patientIsVip ? "Yes" : "No"} />
      </Section>

      {/* Linked Encounter */}
      {flag.encounterId ? (
        <Section title="Linked Encounter">
          <DetailRow label="Department" value={flag.encounterDepartment ?? "—"} />
          <DetailRow
            label="Scheduled"
            value={
              flag.encounterStart && flag.encounterEnd
                ? `${new Date(flag.encounterStart).toLocaleString()} – ${new Date(flag.encounterEnd).toLocaleString()}`
                : "—"
            }
          />
        </Section>
      ) : (
        <Section title="Linked Encounter">
          <p style={{ margin: 0, color: "#666", fontStyle: "italic" }}>No linked encounter</p>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>{title}</h3>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", marginBottom: 6, fontSize: 14 }}>
      <span style={{ width: 140, color: "#666", flexShrink: 0 }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
