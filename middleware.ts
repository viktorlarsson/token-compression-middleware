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

        const protectedIndexes = groupToolCallPairs(middle);
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

        // Filter pinnedEnd: remove orphaned tool results
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
            for (const part of msg.content) {
              if (
                part.type === "tool-result" &&
                !preservedToolCallIds.has(part.toolCallId)
              ) {
                return false; // orphaned result
              }
            }
          }
          return true;
        });

        return {
          ...params,
          prompt: [...pinnedStart, ...compressedMiddle, ...filteredPinnedEnd],
        };
      }

      return params;
    },
  };
};
