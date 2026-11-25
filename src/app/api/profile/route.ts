import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDbSchema, getDb } from "@/db";
import { candidateProfiles } from "@/db/schema";
import { getOrCreateDefaultProfile, getProfileDocuments } from "@/lib/repository";

const UpdateProfileSchema = z.object({
  fullName: z.string().min(1),
  headline: z.string().min(1),
  seniority: z.string().min(1),
  summary: z.string(),
  skills: z.array(z.string()),
  languages: z.array(z.object({ language: z.string(), level: z.string() })),
  acceptedContracts: z.array(z.string()),
  targetScope: z.enum(["national", "international", "both"]),
  minMonthlyNetBrl: z.number().min(0),
  minHourlyUsd: z.number().min(0),
  weeklyFreeHours: z.number().min(1).max(80),
  githubUsername: z.string().optional().default(""),
  linkedinUrl: z.string().optional().default(""),
});

export async function GET() {
  const profile = await getOrCreateDefaultProfile();
  const documents = await getProfileDocuments(profile.id);
  return NextResponse.json({ profile, documents });
}

export async function PUT(req: Request) {
  try {
    await ensureDbSchema();
    const current = await getOrCreateDefaultProfile();
    const body = UpdateProfileSchema.parse(await req.json());
    const db = getDb();
    const now = new Date().toISOString();

    await db
      .update(candidateProfiles)
      .set({
        fullName: body.fullName,
        headline: body.headline,
        seniority: body.seniority,
        summary: body.summary,
        skillsJson: JSON.stringify(body.skills),
        languagesJson: JSON.stringify(body.languages),
        acceptedContractsJson: JSON.stringify(body.acceptedContracts),
        targetScope: body.targetScope,
        minMonthlyNetBrl: body.minMonthlyNetBrl,
        minHourlyUsd: body.minHourlyUsd,
        weeklyFreeHours: body.weeklyFreeHours,
        githubUsername: body.githubUsername,
        linkedinUrl: body.linkedinUrl,
        updatedAt: now,
      })
      .where(eq(candidateProfiles.id, current.id));

    const updated = await getOrCreateDefaultProfile();
    return NextResponse.json({ profile: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao atualizar perfil" },
      { status: 400 }
    );
  }
}

