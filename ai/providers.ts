import { customProvider } from "ai";
import { createOllama } from "ollama-ai-provider";

const ollama = createOllama();

const languageModels = {
  "deepseek-r1": ollama("deepseek-r1"),
};

export const model = customProvider({
  languageModels,
});

export type modelID = keyof typeof languageModels;

export const MODELS = Object.keys(languageModels);

export const defaultModel: modelID = "deepseek-r1";
