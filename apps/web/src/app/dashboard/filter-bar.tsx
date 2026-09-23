"use client";

import { REVIEW_STATUSES, SEVERITY_LEVELS } from "@caduward/shared";
import { useRouter } from "next/navigation";

interface Props {
  currentSeverity?: string;
  currentStatus?: string;
}

export function FilterBar({ currentSeverity, currentStatus }: Props) {
  const router = useRouter();

  function applyFilters(severity?: string, status?: string) {
    const params = new URLSearchParams();
    if (severity) params.set("severity", severity);
    if (status) params.set("status", status);
    const qs = params.toString();
    router.push(`/dashboard${qs ? `?${qs}` : ""}`);
  }

  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
      <select
        value={currentSeverity ?? ""}
        onChange={(e) => applyFilters(e.target.value || undefined, currentStatus)}
        style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 4, fontSize: 13 }}
      >
        <option value="">All severities</option>
        {SEVERITY_LEVELS.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>

      <select
        value={currentStatus ?? ""}
        onChange={(e) => applyFilters(currentSeverity, e.target.value || undefined)}
        style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 4, fontSize: 13 }}
      >
        <option value="">All statuses</option>
        {REVIEW_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
}
