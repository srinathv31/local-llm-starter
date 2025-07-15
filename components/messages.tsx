import type { Message as TMessage, TextPart } from "ai";
import { Message } from "./message";
import { useScrollToBottom } from "@/lib/hooks/use-scroll-to-bottom";

// Define ReasoningUIPart locally to match the renderer
interface LocalReasoningUIPart {
  type: "reasoning";
  reasoning: string;
  details: Array<{ type: "text"; text: string }>;
}

// Utility to parse <think>...</think> tags
function parseReasoningParts(
  text: string
): (TextPart | LocalReasoningUIPart)[] {
  const match = text.match(/<think>([\s\S]*?)<\/think>([\s\S]*)/);
  if (match) {
    return [
      {
        type: "reasoning",
        reasoning: match[1].trim(),
        details: [{ type: "text", text: match[1].trim() }],
      },
      {
        type: "text",
        text: match[2].trim(),
      },
    ];
  }
  return [{ type: "text", text }];
}

export const Messages = ({
  messages,
  isLoading,
  status,
}: {
  messages: TMessage[];
  isLoading: boolean;
  status: "error" | "submitted" | "streaming" | "ready";
}) => {
  const [containerRef, endRef] = useScrollToBottom();

  // For every assistant message, parse every text part for <think>...</think>
  const parsedMessages = messages.map((m) => {
    if (m.role === "assistant" && m.parts) {
      const newParts = m.parts.flatMap((part) => {
        if (part.type === "text") {
          return parseReasoningParts(part.text) as unknown as (
            | TextPart
            | any
          )[];
        }
        return [part];
      });
      return { ...m, parts: newParts };
    }
    return m;
  });

  return (
    <div
      className="flex-1 h-full space-y-4 overflow-y-auto py-8"
      ref={containerRef}
    >
      <div className="max-w-xl mx-auto pt-8">
        {parsedMessages.map((m, i) => (
          <Message
            key={i}
            isLatestMessage={i === parsedMessages.length - 1}
            isLoading={isLoading}
            message={m}
            status={status}
          />
        ))}
        <div className="h-1" ref={endRef} />
      </div>
    </div>
  );
};
