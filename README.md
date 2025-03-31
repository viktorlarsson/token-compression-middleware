# Token Compression Middleware

When middle-out compression is enabled, Token Compression Middleware ensures the prompt fits within the model’s context window by trimming or removing messages from the middle, based on your total token requirement (input + output).

This approach is useful when perfect recall isn’t necessary. It reduces prompt size by removing or shortening messages from the middle until everything fits within the model’s context window.

Compress LLM message prompts by removing middle messages — **without breaking tool call chains**.

## Features

- Preserves `tool-call` → `tool-result` links
- Token-aware compression
- Adjustable settings (token limit, pin count)
- Plug & play middleware for AI SDK

## Installation

```bash
# Bun
bun add token-compression-middleware

# pnpm
pnpm add token-compression-middleware

# npm
npm install token-compression-middleware

# yarn
yarn add token-compression-middleware
```

## Usage

```ts
import { tokenBasedCompressionMiddleware } from "ai-sdk-token-compression";
import { wrapLanguageModel } from "ai";

const wrappedLanguageModel = wrapLanguageModel({
  model: "gpt-4o",
  middleware: [tokenBasedCompressionMiddleware],
});
```

## ⚙️ Token Counting

By default, this middleware uses a simple `estimateTokenCount()` approximation (e.g., `text.length / 4`).

For more accurate results, pass your own tokenizer:

```ts
import { encoding_for_model } from "@dqbd/tiktoken";
import { tokenBasedCompressionMiddleware } from "ai-sdk-token-compression";

// You can use any supported model like 'gpt-3.5-turbo', 'gpt-4', 'gpt-4o'
const encoder = encoding_for_model("gpt-4o");

const middleware = tokenBasedCompressionMiddleware({
  maxInputTokens: 8000,
  pinnedStartCount: 3,
  pinnedEndCount: 2,
  tokenCountFn: (msg) => {
    const text =
      typeof msg.content === "string"
        ? msg.content
        : JSON.stringify(msg.content);
    const tokens = encoder.encode(text);
    const count = tokens.length;

    // Free memory after use
    //encoder.free();

    return count;
  },
});
```
