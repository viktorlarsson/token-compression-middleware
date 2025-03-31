[![experimental](http://badges.github.io/stability-badges/dist/experimental.svg)](http://github.com/badges/stability-badges)

# Token Compression Middleware

````mermaid
flowchart TD
    A[Start transformParams] --> B{type is generate/stream?}
    B -- No --> Z[Return params unchanged]
    B -- Yes --> C[Check if params.prompt is an array]
    C -- No --> Z
    C -- Yes --> D[Count total token usage]

    D --> E{Tokens > maxInputTokens?}
    E -- No --> Z
    E -- Yes --> F[Split prompt into pinnedStart / middle / pinnedEnd]
    F --> G[Compute protectedIndexes from tool-call/result pairs]

    G --> H[Iteratively remove messages from middle]
    H --> I[Ensure tool-call IDs in pinnedStart/middle are tracked]
    I --> J[Filter pinnedEnd to match preserved toolCallIds]

    J --> K[Rebuild finalPrompt with start + compressedMiddle + end]
    K --> L[Track pending toolCallIds]
    L --> M[Remove dangling tool-calls without result]

    M --> N[Return transformed prompt in params]``

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
````

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
