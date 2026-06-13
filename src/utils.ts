import type { ResolvedModel } from "./types";

export function parseModel(full: string): ResolvedModel {
  const slashIndex = full.indexOf("/");
  if (slashIndex === -1) {
    throw new Error(
      `Invalid model format "${full}" — expected "provider/model" (e.g. "groq/llama-3.1-8b-instant")`
    );
  }
  return {
    provider: full.slice(0, slashIndex),
    modelId: full.slice(slashIndex + 1),
  };
}
