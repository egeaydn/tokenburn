import { describe, expect, it } from "vitest";
import { aggregate, normalizeProject, totalOf } from "../src/core/aggregate.js";
import { shortenPaths } from "../src/output/table.js";
import { CODEX_CHATS, projectOf } from "../src/providers/codex.js";
import type { UsageRecord } from "../src/providers/types.js";

const rec = (over: Partial<UsageRecord>): UsageRecord => ({
  timestamp: new Date(2026, 9, 12, 12),
  provider: "claude-code",
  model: "claude-sonnet-5-5",
  project: "/work/app",
  sessionId: "s",
  inputTokens: 1_000_000,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWrite5mTokens: 0,
  cacheWrite1hTokens: 0,
  ...over,
});

describe("normalizeProject", () => {
  it("unifies drive letter case, separators and trailing slashes", () => {
    expect(normalizeProject("c:\\Users\\me\\repo")).toBe("C:/Users/me/repo");
    expect(normalizeProject("C:\\Users\\me\\repo\\")).toBe("C:/Users/me/repo");
    expect(normalizeProject("/home/me/repo/")).toBe("/home/me/repo");
    expect(normalizeProject("/")).toBe("/");
  });
});

describe("project aggregation", () => {
  it("merges the same folder across tools and sorts by cost, biggest first", async () => {
    const rows = await aggregate(
      [
        rec({ project: "c:\\code\\small", inputTokens: 1_000_000 }),
        rec({ project: "C:\\code\\big", inputTokens: 5_000_000 }),
        rec({ project: "C:\\code\\small", provider: "codex", model: "gpt-5.6-luna" }),
      ],
      "project",
    );
    expect(rows.map((r) => r.key)).toEqual(["C:/code/big", "C:/code/small"]);
    expect(rows[1]?.providers).toEqual(["claude-code", "codex"]);
    expect(totalOf(rows).providers).toEqual(["claude-code", "codex"]);
  });

  it("keeps unpriced models visible per project", async () => {
    const rows = await aggregate([rec({ model: "mystery-1" })], "project");
    expect(rows[0]?.unpricedModels).toEqual(["mystery-1"]);
  });
});

describe("shortenPaths", () => {
  it("uses the folder name when unique and adds parents only when needed", () => {
    const short = shortenPaths(["/a/api", "/a/web", "/b/web", "/c/deep/nested/x"]);
    expect(short.get("/a/api")).toBe("api");
    expect(short.get("/a/web")).toBe("a/web");
    expect(short.get("/b/web")).toBe("b/web");
    expect(short.get("/c/deep/nested/x")).toBe("x");
  });

  it("falls back to the full key when there are no segments", () => {
    expect(shortenPaths(["(codex chats)"]).get("(codex chats)")).toBe("(codex chats)");
    expect(shortenPaths(["/"]).get("/")).toBe("/");
  });
});

describe("codex scratch chats", () => {
  it("groups repo-less chat folders but leaves real repos alone", () => {
    expect(projectOf("C:\\Users\\me\\Documents\\Codex\\2026-09-06\\fix-my-bug")).toBe(CODEX_CHATS);
    expect(projectOf("/home/me/Documents/Codex/2026-09-06/fix-my-bug")).toBe(CODEX_CHATS);
    expect(projectOf("C:\\Users\\me\\source\\repos\\app")).toBe(
      "C:\\Users\\me\\source\\repos\\app",
    );
    expect(projectOf("/home/me/Codex/notes")).toBe("/home/me/Codex/notes");
  });
});
