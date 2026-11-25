import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDbSchema, getDb } from "@/db";
import { applications, jobs } from "@/db/schema";
import { mapApplicationRow, mapJobRow } from "@/lib/repository";

const UpsertApplicationSchema = z.object({
  jobId: z.string().min(1),
  status: z.enum([
    "saved",
    "pitch_ready",
    "applied",
    "interview",
    "active",
    "discarded",
  ]),
  negotiatedMonthlyBrl: z.number().min(0).optional(),
  estimatedWeeklyHours: z.number().min(1).max(80).optional(),
  notes: z.string().optional(),
  contactInfo: z.string().optional(),
  followUpDate: z.string().optional(),
});

export async function GET() {
  await ensureDbSchema();
  const db = getDb();

  const [appRows, jobRows] = await Promise.all([
    db.select().from(applications).orderBy(desc(applications.updatedAt)),
    db.select().from(jobs),
  ]);

  const jobMap = new Map(jobRows.map((j) => [j.id, mapJobRow(j)]));
  const items = appRows
    .map((a) => ({
      application: mapApplicationRow(a),
      job: jobMap.get(a.jobId) || null,
    }))
    .filter((x) => x.job !== null);

  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  try {
    await ensureDbSchema();
    const body = UpsertApplicationSchema.parse(await req.json());
    const db = getDb();

    const [jobRow] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, body.jobId))
      .limit(1);
    if (!jobRow) {
      return NextResponse.json({ error: "Vaga não encontrada" }, { status: 404 });
    }

    const now = new Date().toISOString();
    const defaultMonthly =
      body.negotiatedMonthlyBrl ?? jobRow.estimatedMonthlyNetBrl ?? 0;

    await db
      .insert(applications)
      .values({
        id: crypto.randomUUID(),
        jobId: body.jobId,
        status: body.status,
        negotiatedMonthlyBrl: defaultMonthly,
        estimatedWeeklyHours: body.estimatedWeeklyHours ?? 20,
        notes: body.notes ?? "",
        contactInfo: body.contactInfo ?? "",
        followUpDate: body.followUpDate ?? "",
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: applications.jobId,
        set: {
          status: body.status,
          ...(body.negotiatedMonthlyBrl !== undefined
            ? { negotiatedMonthlyBrl: body.negotiatedMonthlyBrl }
            : {}),
          ...(body.estimatedWeeklyHours !== undefined
            ? { estimatedWeeklyHours: body.estimatedWeeklyHours }
            : {}),
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          ...(body.contactInfo !== undefined
            ? { contactInfo: body.contactInfo }
            : {}),
          ...(body.followUpDate !== undefined
            ? { followUpDate: body.followUpDate }
            : {}),
          updatedAt: now,
        },
      });

    const [saved] = await db
      .select()
      .from(applications)
      .where(eq(applications.jobId, body.jobId))
      .limit(1);

    return NextResponse.json({ application: mapApplicationRow(saved) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao salvar candidatura" },
      { status: 400 }
    );
  }
}

