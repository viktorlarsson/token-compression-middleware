import type { LanguageModelV1Message } from "@ai-sdk/provider";

export const groupToolCallPairs = (
  messages: LanguageModelV1Message[]
): Set<number> => {
  const protectedIndexes = new Set<number>();
  const toolCalls = new Map<string, number>();
  const toolResults = new Map<string, number>();

  messages.forEach((msg, idx) => {
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "tool-call" && part.toolCallId) {
          toolCalls.set(part.toolCallId, idx);
        }
      }
    }

    if (msg.role === "tool" && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "tool-result" && part.toolCallId) {
          toolResults.set(part.toolCallId, idx);
        }
      }
    }
  });

  for (const [id, callIdx] of toolCalls.entries()) {
    const resultIdx = toolResults.get(id);
    if (resultIdx !== undefined) {
      for (
        let i = Math.min(callIdx, resultIdx);
        i <= Math.max(callIdx, resultIdx);
        i++
      ) {
        protectedIndexes.add(i);
      }
    }
  }

  return protectedIndexes;
};
