"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type Socket, io } from "socket.io-client";

interface FlagEvent {
  id: string;
  severity: string;
  triggeredRules: string[];
  summary: string | null;
  createdAt: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#ca8a04",
  low: "#16a34a",
};

export function LiveFlags() {
  const router = useRouter();
  const [flags, setFlags] = useState<FlagEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_CADUWARD_SOCKET_URL ?? "http://localhost:3001";
    const socket: Socket = io(socketUrl, { transports: ["websocket"] });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("flag:new", (flag: FlagEvent) => {
      setFlags((prev) => [flag, ...prev].slice(0, 10));
      router.refresh();
    });

    return () => {
      socket.disconnect();
    };
  }, [router]);

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Live Feed</h3>
        <span
          style={{
            fontSize: 11,
            padding: "2px 6px",
            borderRadius: 4,
            background: connected ? "#dcfce7" : "#fef2f2",
            color: connected ? "#16a34a" : "#dc2626",
          }}
        >
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>

      {flags.length === 0 ? (
        <p style={{ fontSize: 13, color: "#666", margin: 0 }}>Waiting for new flags...</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {flags.map((flag) => (
            <li
              key={flag.id}
              style={{
                padding: "6px 0",
                borderBottom: "1px solid #f3f4f6",
                fontSize: 13,
              }}
            >
              <Link
                href={`/dashboard/flags/${flag.id}`}
                style={{
                  textDecoration: "none",
                  color: "#111",
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    color: SEVERITY_COLORS[flag.severity] ?? "#111",
                    fontWeight: 600,
                    fontSize: 11,
                    textTransform: "uppercase",
                    width: 60,
                  }}
                >
                  {flag.severity}
                </span>
                <span
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {flag.summary ?? flag.triggeredRules.join(", ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
