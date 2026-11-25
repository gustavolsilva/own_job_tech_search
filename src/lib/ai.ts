import { generateText, Output } from "ai";
import { metric } from "@vercel/functions";
import type { z } from "zod";

export function isAiConfigured(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim()
  );
}

export function getConfiguredModels(): { primary: string; fallback: string } {
  return {
    primary: process.env.AI_GATEWAY_MODEL?.trim() || "google/gemini-3.8-flash",
    fallback:
      process.env.AI_GATEWAY_FALLBACK_MODEL?.trim() || "spacexai/grok-4.6",
  };
}

export async function generateStructuredWithFallback<T extends z.ZodTypeAny>(opts: {
  schema: T;
  system: string;
  prompt: string;
  operation: string;
}): Promise<{ data: z.infer<T>; modelUsed: string } | null> {
  if (!isAiConfigured()) {
    return null;
  }

  const { primary, fallback } = getConfiguredModels();
  const candidates = [primary, fallback].filter(Boolean);

  for (const model of candidates) {
    const startedAt = performance.now();
    try {
      const { output } = await generateText({
        model,
        system: opts.system,
        prompt: opts.prompt,
        output: Output.object({ schema: opts.schema }),
      });

      metric("ai.structured.calls", 1, {
        outcome: "success",
        operation: opts.operation,
        model,
      });
      metric("ai.structured.duration_ms", performance.now() - startedAt, {
        operation: opts.operation,
        model,
      });

      return { data: output as z.infer<T>, modelUsed: model };
    } catch (err) {
      metric("ai.structured.calls", 1, {
        outcome: "error",
        operation: opts.operation,
        model,
      });
      console.warn(`[AI] ${opts.operation} falhou no modelo ${model}:`, err);
    }
  }

  return null;
}

export async function generateTextWithFallback(opts: {
  system: string;
  prompt: string;
  operation: string;
}): Promise<{ text: string; modelUsed: string } | null> {
  if (!isAiConfigured()) {
    return null;
  }

  const { primary, fallback } = getConfiguredModels();
  const candidates = [primary, fallback].filter(Boolean);

  for (const model of candidates) {
    const startedAt = performance.now();
    try {
      const { text } = await generateText({
        model,
        system: opts.system,
        prompt: opts.prompt,
      });

      metric("ai.text.calls", 1, {
        outcome: "success",
        operation: opts.operation,
        model,
      });
      metric("ai.text.duration_ms", performance.now() - startedAt, {
        operation: opts.operation,
        model,
      });

      return { text, modelUsed: model };
    } catch (err) {
      metric("ai.text.calls", 1, {
        outcome: "error",
        operation: opts.operation,
        model,
      });
      console.warn(`[AI] ${opts.operation} falhou no modelo ${model}:`, err);
    }
  }

  return null;
}

