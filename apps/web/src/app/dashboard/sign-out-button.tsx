"use client";

import { signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        await signOut();
        router.push("/login");
      }}
      style={{
        padding: "6px 12px",
        fontSize: 13,
        border: "1px solid #ddd",
        borderRadius: 4,
        background: "#fff",
        cursor: "pointer",
      }}
    >
      Sign out
    </button>
  );
}
