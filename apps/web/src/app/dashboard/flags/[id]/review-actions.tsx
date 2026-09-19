"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const ACTIONS = [
  { status: "reviewed", label: "Mark Reviewed", color: "#16a34a" },
  { status: "escalated", label: "Escalate", color: "#dc2626" },
  { status: "dismissed", label: "Dismiss", color: "#6b7280" },
] as const;

interface Props {
  flagId: string;
  currentStatus: string;
}

export function ReviewActions({ flagId, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleAction(status: string) {
    setLoading(status);
    setError("");

    try {
      const res = await fetch(`/api/flags/${flagId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? "Failed to update");
        return;
      }

      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  if (currentStatus !== "open") {
    return (
      <span
        style={{
          fontSize: 13,
          padding: "4px 10px",
          borderRadius: 4,
          background: "#f3f4f6",
          textTransform: "capitalize",
        }}
      >
        {currentStatus}
      </span>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        {ACTIONS.map(({ status, label, color }) => (
          <button
            key={status}
            type="button"
            disabled={loading !== null}
            onClick={() => handleAction(status)}
            style={{
              padding: "6px 14px",
              fontSize: 13,
              border: `1px solid ${color}`,
              borderRadius: 4,
              background: loading === status ? color : "#fff",
              color: loading === status ? "#fff" : color,
              cursor: loading !== null ? "not-allowed" : "pointer",
              opacity: loading !== null && loading !== status ? 0.5 : 1,
            }}
          >
            {loading === status ? "..." : label}
          </button>
        ))}
      </div>
      {error && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 6 }}>{error}</p>}
    </div>
  );
}
