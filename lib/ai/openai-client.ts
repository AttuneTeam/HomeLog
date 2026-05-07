import { createOpenAI } from "@ai-sdk/openai";

export const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const embeddingModel = openai.embedding("text-embedding-3-small");
export const extractionModel = openai("gpt-4o-mini");
export const classificationModel = openai("gpt-5.5");
