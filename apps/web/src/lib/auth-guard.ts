import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

type UserRole = "admin" | "reviewer";

/**
 * Get the current session from the request headers. Returns null if not
 * authenticated.
 */
export async function getSession() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session;
}

/**
 * Require an authenticated session. Redirects to /login if not authenticated.
 * Use in Server Components and Server Actions.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}

/**
 * Require a specific role. Redirects to /login if not authenticated, throws
 * 403 if the user lacks the required role.
 */
export async function requireRole(role: UserRole) {
  const session = await requireSession();
  if (session.user.role !== role && session.user.role !== "admin") {
    throw new Response("Forbidden", { status: 403 });
  }
  return session;
}

/**
 * Guard an API route handler. Returns the session if authenticated, or a 401
 * JSON response if not. Optionally checks for a required role.
 */
export async function guardApi(options?: { role?: UserRole }) {
  const session = await getSession();
  if (!session) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (options?.role && session.user.role !== options.role && session.user.role !== "admin") {
    return { error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}
