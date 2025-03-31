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
    transformParams: async (ctx) => {
      const { params, type } = ctx;

      if (
        (type === "generate" || type === "stream") &&
        Array.isArray(params.prompt)
      ) {
        const messages = params.prompt as LanguageModelV1Message[];

        if (countTokens(messages) <= maxInputTokens) {
          return params;
        }

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

        const compressed = [...pinnedStart, ...compressedMiddle, ...pinnedEnd];
        return { ...params, prompt: compressed };
      }

      return params;
    },
  };
};
