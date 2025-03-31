import { describe, it, expect } from "vitest";
import type { LanguageModelV1Message } from "@ai-sdk/provider";
import { groupToolCallPairs } from "../groupToolCallPairs";

// Helper to quickly build messages
const createMsg = (
  role: LanguageModelV1Message["role"],
  content: any
): LanguageModelV1Message => ({ role, content });

// Basic assistant → tool message pair
const toolCallPair = [
  createMsg("assistant", [
    {
      type: "tool-call",
      toolCallId: "abc",
      toolName: "getData",
      args: "{}",
    },
  ]),
  createMsg("tool", [
    {
      type: "tool-result",
      toolCallId: "abc",
      toolName: "getData",
      result: { value: 123 },
    },
  ]),
];

describe("groupToolCallPairs", () => {
  it("returns empty set when no tool-call or tool-result is present", () => {
    const msgs: LanguageModelV1Message[] = [
      createMsg("user", [{ type: "text", text: "hi" }]),
      createMsg("assistant", [{ type: "text", text: "hello" }]),
    ];

    const protectedIndexes = groupToolCallPairs(msgs);
    expect(protectedIndexes.size).toBe(0);
  });

  it("protects indexes of matched tool-call → tool-result pairs", () => {
    const messages: LanguageModelV1Message[] = [
      createMsg("user", [{ type: "text", text: "before" }]),
      ...toolCallPair,
      createMsg("assistant", [{ type: "text", text: "after" }]),
    ];

    const protectedIndexes = groupToolCallPairs(messages);

    // Tool call at index 1, result at index 2 → protect 1 and 2
    expect(protectedIndexes.has(1)).toBe(true);
    expect(protectedIndexes.has(2)).toBe(true);
    expect(protectedIndexes.size).toBe(2);
  });

  it("protects the full range between tool-call and tool-result even when split", () => {
    const messages: LanguageModelV1Message[] = [
      createMsg("user", [{ type: "text", text: "start" }]),
      createMsg("assistant", [
        {
          type: "tool-call",
          toolCallId: "x",
          toolName: "getFoo",
          args: "{}",
        },
      ]),
      createMsg("user", [{ type: "text", text: "middle" }]),
      createMsg("tool", [
        {
          type: "tool-result",
          toolCallId: "x",
          toolName: "getFoo",
          result: { foo: true },
        },
      ]),
    ];

    const protectedIndexes = groupToolCallPairs(messages);

    // Call at 1, result at 3 → protect [1,2,3]
    expect([...protectedIndexes].sort()).toEqual([1, 2, 3]);
  });

  it("ignores unmatched tool-calls", () => {
    const messages: LanguageModelV1Message[] = [
      createMsg("assistant", [
        {
          type: "tool-call",
          toolCallId: "unmatched",
          toolName: "oops",
          args: "{}",
        },
      ]),
    ];

    const protectedIndexes = groupToolCallPairs(messages);
    expect(protectedIndexes.size).toBe(0);
  });

  it("ignores unmatched tool-results", () => {
    const messages: LanguageModelV1Message[] = [
      createMsg("tool", [
        {
          type: "tool-result",
          toolCallId: "unmatched",
          toolName: "oops",
          result: {},
        },
      ]),
    ];

    const protectedIndexes = groupToolCallPairs(messages);
    expect(protectedIndexes.size).toBe(0);
  });

  it("handles multiple tool-call pairs independently", () => {
    const messages: LanguageModelV1Message[] = [
      ...toolCallPair, // indexes 0–1
      createMsg("assistant", [
        { type: "tool-call", toolCallId: "z", toolName: "bar", args: "{}" },
      ]),
      createMsg("tool", [
        { type: "tool-result", toolCallId: "z", toolName: "bar", result: {} },
      ]),
    ];

    const protectedIndexes = groupToolCallPairs(messages);
    expect([...protectedIndexes].sort()).toEqual([0, 1, 2, 3]);
  });
});
