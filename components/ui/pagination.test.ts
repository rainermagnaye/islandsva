import { describe, expect, it } from "vitest";
import { pageList } from "./pagination";

describe("pageList", () => {
  it("lists every page up to seven", () => {
    expect(pageList(1, 1)).toEqual([1]);
    expect(pageList(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("keeps first, last and the current page's neighbours, with gaps, beyond seven", () => {
    expect(pageList(1, 12)).toEqual([1, 2, 3, 4, "gap", 12]);
    expect(pageList(6, 12)).toEqual([1, "gap", 5, 6, 7, "gap", 12]);
    expect(pageList(12, 12)).toEqual([1, "gap", 9, 10, 11, 12]);
  });

  it("never shows a gap that hides a single page", () => {
    expect(pageList(4, 8)).toEqual([1, "gap", 3, 4, 5, "gap", 8]);
    expect(pageList(3, 8)).toEqual([1, 2, 3, 4, "gap", 8]);
  });
});
