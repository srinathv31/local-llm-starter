import { customProvider } from "ai";
import { createOllama } from "ollama-ai-provider";

const ollama = createOllama();

const languageModels = {
  "deepseek-r1": ollama("deepseek-r1"),
  "deepseek-r1-distill-qwen-1.5b": ollama("llama3.2:3b"), // dummy model to point to local python backend
};

export const model = customProvider({
  languageModels,
});

export const MODELS = Object.keys(languageModels);

export const defaultModel: modelID = "deepseek-r1";
export type modelID = keyof typeof languageModels;
