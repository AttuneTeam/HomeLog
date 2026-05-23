import { tavily } from "@tavily/core";

export function getTavilyClient() {
  if (!process.env.TAVILY_API_KEY) {
    throw new Error("TAVILY_API_KEY is not configured");
  }
  return tavily({ apiKey: process.env.TAVILY_API_KEY });
}
