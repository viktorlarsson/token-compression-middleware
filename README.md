[![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

# Token Compression Middleware

Token Compression Middleware is a middle-out compression that ensures the prompt fits within the model’s context window by trimming or removing messages from the middle, based on your total token requirement (input + output).

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

// You can use any supported model
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

## How it works

```mermaid
flowchart TD
A[Start transformParams] --> B{Is prompt too long?}
B -- No --> Z[Return prompt unchanged]
B -- Yes --> C[Split into pinnedStart, middle, pinnedEnd]
C --> D[Identify tool-call pairs to protect]
D --> E[Remove unprotected messages from middle]
E --> F[Filter pinnedEnd to valid tool-results]
F --> G[Rebuild prompt]
G --> H[Clean up unmatched tool-calls]
H --> I[Return compressed prompt]
```
