import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

const PROVIDERS = {
  anthropic: { keyVar: "ANTHROPIC_API_KEY", make: (key: string, id: string) => createAnthropic({ apiKey: key })(id) },
  openai: { keyVar: "OPENAI_API_KEY", make: (key: string, id: string) => createOpenAI({ apiKey: key })(id) },
} as const;

export type ModelStatus = { ready: true; label: string } | { ready: false; reason: string };

function parse(env: Record<string, string | undefined> = process.env): { provider: keyof typeof PROVIDERS; id: string } | null {
  const raw = env.AI_MODEL?.trim();
  if (!raw) return null;
  const [provider, ...rest] = raw.split(":");
  const id = rest.join(":");
  if (!provider || !id || !(provider in PROVIDERS)) return null;
  return { provider: provider as keyof typeof PROVIDERS, id };
}

export function modelStatus(env: Record<string, string | undefined> = process.env): ModelStatus {
  const p = parse(env);
  if (!p) return { ready: false, reason: "AI_MODEL is not set as <provider>:<model-id>." };
  if (!env[PROVIDERS[p.provider].keyVar]) return { ready: false, reason: `${PROVIDERS[p.provider].keyVar} is not set.` };
  return { ready: true, label: `${p.provider}:${p.id}` };
}

export function liveModel(): { model: LanguageModel; label: string } {
  const p = parse();
  const status = modelStatus();
  if (!p || !status.ready) throw new Error(status.ready ? "Model not configured" : status.reason);
  return { model: PROVIDERS[p.provider].make(process.env[PROVIDERS[p.provider].keyVar]!, p.id), label: status.label };
}
