import { NextRequest } from "next/server";
import { db, anomalyFlags, eq } from "@caduward/db";
import { reviewStatusSchema } from "@caduward/shared";
import { z } from "zod";
import { guardApi } from "@/lib/auth-guard";

const reviewBody = z.object({
  status: reviewStatusSchema.exclude(["open"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await guardApi();
  if ("error" in guard) return guard.error;

  const { id } = await params;

  const body = reviewBody.safeParse(await request.json());
  if (!body.success) {
    return Response.json(
      { error: "Invalid request body", details: body.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await db
    .update(anomalyFlags)
    .set({ reviewStatus: body.data.status })
    .where(eq(anomalyFlags.id, id))
    .returning({ id: anomalyFlags.id, reviewStatus: anomalyFlags.reviewStatus });

  if (updated.length === 0) {
    return Response.json({ error: "Flag not found" }, { status: 404 });
  }

  return Response.json({ data: updated[0] });
}
