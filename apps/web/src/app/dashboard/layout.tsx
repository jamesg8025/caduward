import { requireSession } from "@/lib/auth-guard";
import type { ReactNode } from "react";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          borderBottom: "1px solid #e5e7eb",
          padding: "12px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a
            href="/dashboard"
            style={{ fontWeight: 700, fontSize: 18, textDecoration: "none", color: "#111" }}
          >
            CaduWard
          </a>
          <span
            style={{
              fontSize: 12,
              color: "#666",
              background: "#f3f4f6",
              padding: "2px 8px",
              borderRadius: 4,
            }}
          >
            {session.user.role ?? "reviewer"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 14, color: "#666" }}>{session.user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  );
}
