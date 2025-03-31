import { describe, it, expect } from "vitest";
import { estimateTokenCount } from "../estimateTokenCount";

describe("estimateTokenCount", () => {
  it("counts plain words", () => {
    expect(estimateTokenCount("hello world")).toBe(2);
  });

  it("counts punctuation as extra tokens", () => {
    expect(estimateTokenCount("hello, world!")).toBe(4);
  });

  it("counts multiple punctuation marks", () => {
    expect(estimateTokenCount("Wow!!! Really? Yes...")).toBe(10);
  });

  it("handles empty string", () => {
    expect(estimateTokenCount("")).toBe(1);
  });

  it("handles mixed content", () => {
    expect(estimateTokenCount("This is a test: (1 + 1) = 2.")).toBe(13);
  });

  it("does not double-count punctuation on its own", () => {
    expect(estimateTokenCount("?!...")).toBe(6);
  });
});
