import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDbSchema, getDb } from "@/db";
import { applicationPitches, jobs } from "@/db/schema";
import { generateHumanizedPitch } from "@/lib/matching-engine";
import { getOrCreateDefaultProfile, mapJobRow } from "@/lib/repository";

const PitchSchema = z.object({
  format: z.enum(["recruiter_dm", "freelance_proposal", "cover_letter"]),
  language: z.enum(["pt", "en"]).default("pt"),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbSchema();
    const { id } = await context.params;
    const body = PitchSchema.parse(await req.json());
    const db = getDb();

    const [jobRow] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    if (!jobRow) {
      return NextResponse.json({ error: "Vaga não encontrada" }, { status: 404 });
    }

    const profile = await getOrCreateDefaultProfile();
    const job = mapJobRow(jobRow);
    const result = await generateHumanizedPitch({
      profile,
      job,
      format: body.format,
      language: body.language,
    });

    const pitchId = crypto.randomUUID();
    const now = new Date().toISOString();

    const [saved] = await db
      .insert(applicationPitches)
      .values({
        id: pitchId,
        jobId: job.id,
        format: body.format,
        language: body.language,
        content: result.content,
        generatedBy: result.generatedBy,
        createdAt: now,
      })
      .returning();

    return NextResponse.json({ pitch: saved });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao gerar proposta" },
      { status: 400 }
    );
  }
}

