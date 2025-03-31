import type { LanguageModelV1Message } from "@ai-sdk/provider";
import type { LanguageModelV1Middleware } from "ai";
import { groupToolCallPairs } from "./groupToolCallPairs";
import { estimateTokenCount } from "./estimateTokenCount";

export interface TokenCompressionOptions {
  maxInputTokens?: number;
  pinnedStartCount?: number;
  pinnedEndCount?: number;
  tokenCountFn?: (message: LanguageModelV1Message) => number;
}

const defaultOptions = {
  maxInputTokens: 8000,
  pinnedStartCount: 4,
  pinnedEndCount: 5,
} satisfies Partial<TokenCompressionOptions>;

export const tokenBasedCompressionMiddleware = (
  options: TokenCompressionOptions = {}
): LanguageModelV1Middleware => {
  const { maxInputTokens, pinnedStartCount, pinnedEndCount, tokenCountFn } = {
    ...defaultOptions,
    ...options,
  };

  const countTokens = (messages: LanguageModelV1Message[]): number =>
    messages.reduce((total, msg) => {
      const content =
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content);
      return total + (tokenCountFn?.(msg) ?? estimateTokenCount(content));
    }, 0);

  return {
    middlewareVersion: "v1",
    transformParams: async ({ type, params }) => {
      if (
        (type === "generate" || type === "stream") &&
        Array.isArray(params.prompt)
      ) {
        const messages = params.prompt as LanguageModelV1Message[];

        if (countTokens(messages) <= maxInputTokens) return params;

        const pinnedStart = messages.slice(0, pinnedStartCount);
        const pinnedEnd = messages.slice(-pinnedEndCount);
        const middle = messages.slice(
          pinnedStartCount,
          messages.length - pinnedEndCount
        );

        const fullMessages = [...pinnedStart, ...middle, ...pinnedEnd];
        const protectedIndexes = new Set(
          [...groupToolCallPairs(fullMessages)].map(
            (idx) => idx - pinnedStartCount
          )
        );

        const compressedMiddle = [...middle];

        while (
          countTokens([...pinnedStart, ...compressedMiddle, ...pinnedEnd]) >
          maxInputTokens
        ) {
          const idxToRemove = compressedMiddle.findIndex(
            (_, idx) => !protectedIndexes.has(idx)
          );
          if (idxToRemove === -1) break;
          compressedMiddle.splice(idxToRemove, 1);
        }

        // Step 1: Track toolCallIds to preserve only valid tool results
        const preservedToolCallIds = new Set<string>();
        for (const msg of [...pinnedStart, ...compressedMiddle]) {
          if (msg.role === "assistant" && Array.isArray(msg.content)) {
            for (const part of msg.content) {
              if (part.type === "tool-call") {
                preservedToolCallIds.add(part.toolCallId);
              }
            }
          }
        }

        const filteredPinnedEnd = pinnedEnd.filter((msg) => {
          if (msg.role === "tool" && Array.isArray(msg.content)) {
            return msg.content.every((part) => {
              return (
                part.type !== "tool-result" ||
                preservedToolCallIds.has(part.toolCallId)
              );
            });
          }
          return true;
        });

        // Step 2: Ensure every tool-call has a corresponding tool-result immediately after
        const finalPrompt: LanguageModelV1Message[] = [];
        const pendingToolCallIds: string[] = [];

        for (let i = 0; i < pinnedStart.length; i++) {
          finalPrompt.push(pinnedStart[i]);
        }
        for (let i = 0; i < compressedMiddle.length; i++) {
          const msg = compressedMiddle[i];
          finalPrompt.push(msg);

          if (msg.role === "assistant" && Array.isArray(msg.content)) {
            for (const part of msg.content) {
              if (part.type === "tool-call") {
                pendingToolCallIds.push(part.toolCallId);
              }
            }
          }

          if (msg.role === "tool" && Array.isArray(msg.content)) {
            for (const part of msg.content) {
              if (
                part.type === "tool-result" &&
                pendingToolCallIds.includes(part.toolCallId)
              ) {
                pendingToolCallIds.splice(
                  pendingToolCallIds.indexOf(part.toolCallId),
                  1
                );
              }
            }
          }
        }

        for (let i = 0; i < filteredPinnedEnd.length; i++) {
          finalPrompt.push(filteredPinnedEnd[i]);

          const msg = filteredPinnedEnd[i];
          if (msg.role === "tool" && Array.isArray(msg.content)) {
            for (const part of msg.content) {
              if (
                part.type === "tool-result" &&
                pendingToolCallIds.includes(part.toolCallId)
              ) {
                pendingToolCallIds.splice(
                  pendingToolCallIds.indexOf(part.toolCallId),
                  1
                );
              }
            }
          }
        }

        // Remove any assistant tool-calls that remain without a response
        const cleanedPrompt = finalPrompt.filter((msg) => {
          if (msg.role === "assistant" && Array.isArray(msg.content)) {
            return msg.content.every((part) => {
              return (
                part.type !== "tool-call" ||
                !pendingToolCallIds.includes(part.toolCallId)
              );
            });
          }
          return true;
        });

        return {
          ...params,
          prompt: cleanedPrompt,
        };
      }

      return params;
    },
  };
};
