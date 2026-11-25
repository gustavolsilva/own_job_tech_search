import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { ensureDbSchema, getDb } from "@/db";
import { candidateProfiles, profileDocuments } from "@/db/schema";
import {
  extractTextFromBuffer,
  fetchGithubSkills,
  parseProfileFromText,
  saveUploadedFileLocally,
} from "@/lib/document-parser";
import { getOrCreateDefaultProfile, getProfileDocuments } from "@/lib/repository";

export async function POST(req: Request) {
  try {
    await ensureDbSchema();
    const profile = await getOrCreateDefaultProfile();
    const formData = await req.formData();

    const file = formData.get("file") as File | null;
    const rawTextInput = (formData.get("rawText") as string | null) || "";
    const githubUsername = (formData.get("githubUsername") as string | null) || "";
    const linkedinUrl = (formData.get("linkedinUrl") as string | null) || "";

    let extractedText = rawTextInput.trim();
    let fileName = "texto-colado.txt";
    let fileType: "pdf" | "docx" | "doc" | "linkedin_pdf" | "text" = "text";
    let fileSize = Buffer.byteLength(extractedText, "utf-8");
    let storagePath = "";

    if (file && file.size > 0) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const parsedFile = await extractTextFromBuffer(buffer, file.name);
      extractedText = [parsedFile.text, extractedText].filter(Boolean).join("\n\n");
      fileName = file.name;
      fileType = parsedFile.fileType;
      fileSize = file.size;
      storagePath = await saveUploadedFileLocally(buffer, file.name);
    }

    if (!extractedText && !githubUsername) {
      return NextResponse.json(
        { error: "Envie um arquivo (.pdf, .docx, .doc), cole o texto do perfil ou informe seu GitHub." },
        { status: 400 }
      );
    }

    const db = getDb();
    const now = new Date().toISOString();

    if (extractedText) {
      await db.insert(profileDocuments).values({
        id: crypto.randomUUID(),
        profileId: profile.id,
        fileName,
        fileType,
        fileSize,
        storagePath,
        extractedText: extractedText.slice(0, 50000),
        createdAt: now,
      });
    }

    const [parsed, ghSkills] = await Promise.all([
      extractedText
        ? parseProfileFromText(extractedText)
        : Promise.resolve({
            fullName: profile.fullName,
            headline: profile.headline,
            seniority: profile.seniority,
            summary: profile.summary,
            skills: profile.skills,
            languages: profile.languages,
            experiences: profile.experiences,
            parsedBy: "heuristic" as const,
          }),
      githubUsername ? fetchGithubSkills(githubUsername) : Promise.resolve([]),
    ]);

    const mergedSkills = Array.from(new Set([...parsed.skills, ...ghSkills]));

    await db
      .update(candidateProfiles)
      .set({
        fullName: parsed.fullName || profile.fullName,
        headline: parsed.headline || profile.headline,
        seniority: parsed.seniority || profile.seniority,
        summary: parsed.summary || profile.summary,
        skillsJson: JSON.stringify(mergedSkills),
        experiencesJson: JSON.stringify(parsed.experiences),
        languagesJson: JSON.stringify(parsed.languages),
        githubUsername: githubUsername || profile.githubUsername,
        linkedinUrl: linkedinUrl || profile.linkedinUrl,
        updatedAt: now,
      })
      .where(eq(candidateProfiles.id, profile.id));

    const updated = await getOrCreateDefaultProfile();
    const documents = await getProfileDocuments(profile.id);

    return NextResponse.json({
      profile: updated,
      documents,
      parsedBy: parsed.parsedBy,
      githubSkillsAdded: ghSkills,
    });
  } catch (err) {
    console.error("Erro no upload de perfil:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao processar documento" },
      { status: 500 }
    );
  }
}

