"use client";

import { defaultModel, type modelID } from "@/ai/providers";
import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import { Textarea } from "./textarea";
import { ProjectOverview } from "./project-overview";
import { Messages } from "./messages";
import { Header } from "./header";
import { toast } from "sonner";

export default function Chat() {
  const [selectedModel, setSelectedModel] = useState<modelID>(defaultModel);
  const { messages, input, handleInputChange, handleSubmit, status, stop } =
    useChat({
      api:
        selectedModel === "deepseek-r1-distill-qwen-1.5b"
          ? "/api/llm-chat"
          : "/api/chat",
      maxSteps: 5,
      body:
        selectedModel !== "deepseek-r1-distill-qwen-1.5b"
          ? {
              selectedModel,
            }
          : undefined,
      experimental_prepareRequestBody:
        selectedModel === "deepseek-r1-distill-qwen-1.5b"
          ? (body) => ({
              prompt: body.messages[body.messages.length - 1]?.content || "",
            })
          : undefined,
      onError: (error) => {
        console.log(error);
        toast.error(
          error.message.length > 0
            ? error.message
            : "An error occured, please try again later.",
          { position: "top-center", richColors: true }
        );
      },
    });

  const isLoading = status === "streaming" || status === "submitted";

  return (
    <div className="h-dvh flex flex-col justify-center w-full stretch">
      <Header />
      {messages.length === 0 ? (
        <div className="max-w-xl mx-auto w-full">
          <div className="relative text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent relative z-10">
              Supercharged with AI
            </h1>
          </div>
          <ProjectOverview />
        </div>
      ) : (
        <Messages messages={messages} isLoading={isLoading} status={status} />
      )}
      <form
        onSubmit={handleSubmit}
        className="pb-8 bg-white dark:bg-black w-full max-w-xl mx-auto px-4 sm:px-0"
      >
        <Textarea
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          handleInputChange={handleInputChange}
          input={input}
          isLoading={isLoading}
          status={status}
          stop={stop}
        />
        {messages.length > 0 && (
          <div className="text-left mt-2 ml-4">
            <p className="text-md font-medium bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 bg-clip-text text-transparent">
              Supercharged with AI{" "}
              <span className="bg-none text-black dark:text-white">🔎</span>
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
