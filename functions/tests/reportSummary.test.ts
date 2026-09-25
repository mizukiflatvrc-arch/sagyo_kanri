import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReportSummaryInput, parseReportSummary } from "../../src/report/summarizer";
import { calculateReportPeriods, createReportData } from "../../src/utils/report";
import { createReportSummaryHandler, parseReportSummaryRequest, ServerConfigurationError } from "../src/reportSummary";

function inputFixture() {
  return createReportSummaryInput(createReportData([{
    libraryId: "central", enteredAt: new Date("2026-09-06T01:00:00Z"),
    exitedAt: new Date("2026-09-06T03:00:00Z"), stayMinutes: 120,
    concentrationScore: 7, anxietyScore: 3, fatigueScore: 5, selfCriticismScore: 2,
    actualTaskText: "実装", note: "メモ",
  }], calculateReportPeriods("2026-09-07", 7)!, new Map([["central", "中央図書館"]])), true);
}
const summary = {
  daily: [{ date: "2026-09-06", workSummary: "実装を進めた。", noteSummary: "メモを残した。" }],
  workSummary: "実装", noteSummary: "記録", overview: "振り返り",
};

describe("reportSummary HTTP handler", () => {
  const verifyIdToken = vi.fn();
  const generate = vi.fn();
  const logError = vi.fn();
  const handler = createReportSummaryHandler({ verifyIdToken, generate, logError });
  beforeEach(() => {
    vi.resetAllMocks();
    verifyIdToken.mockResolvedValue({ uid: "private-uid", email: "private@example.test" });
    generate.mockResolvedValue(JSON.stringify(summary));
  });
  async function call(body: unknown = { input: inputFixture() }, authorization: string | undefined = "Bearer valid-token", method = "POST") {
    const response = { set: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    await handler({ method, headers: authorization === undefined ? {} : { authorization }, body }, response);
    return response;
  }

  it.each(["GET", "PUT", "DELETE", "OPTIONS"])("%s → 405", async (method) => {
    const response = await call(undefined, undefined, method);
    expect(response.status).toHaveBeenCalledWith(405);
    expect(response.set).toHaveBeenCalledWith("Allow", "POST");
    expect(verifyIdToken).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });
  it.each(["", "Basic token", "Bearer", "Bearer token extra"])("missing/malformed token %s → 401", async (token) => {
    const response = await call(undefined, token);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(verifyIdToken).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
  });
  it("Authorization headerなし → 401", async () => {
    const response = { set: vi.fn().mockReturnThis(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    await handler({ method: "POST", headers: {}, body: { input: inputFixture() } }, response);
    expect(response.status).toHaveBeenCalledWith(401);
    expect(generate).not.toHaveBeenCalled();
  });
  it("invalid token / verification failure → 401", async () => {
    verifyIdToken.mockRejectedValue(new Error("private auth error"));
    const response = await call();
    expect(response.status).toHaveBeenCalledWith(401);
    expect(generate).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
  });
  it.each([null, [], {}, { input: null }, { input: [] }, { input: inputFixture(), model: "client-model" }, { input: inputFixture(), instructions: "client-prompt" }])("invalid body → 400", async (body) => {
    const response = await call(body);
    expect(response.status).toHaveBeenCalledWith(400);
    expect(generate).not.toHaveBeenCalled();
  });
  it("valid request → adapter → unwrapped, frontend-compatible 200", async () => {
    const input = inputFixture();
    const response = await call({ input });
    expect(verifyIdToken).toHaveBeenCalledWith("valid-token");
    expect(generate).toHaveBeenCalledExactlyOnceWith(input);
    expect(JSON.stringify(generate.mock.calls)).not.toMatch(/private-uid|private@example/);
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith(summary);
    expect(parseReportSummary(response.json.mock.calls[0]![0])).toEqual(summary);
    expect(response.set).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
  it.each([
    undefined, "", "not JSON", "null", "{}",
    JSON.stringify({ ...summary, overview: 7 }),
    JSON.stringify({ ...summary, extra: "not allowed" }),
    JSON.stringify({ ...summary, daily: [{ date: "2026-09-06" }] }),
    JSON.stringify({ ...summary, daily: [{ ...summary.daily[0], date: "2026-08-30" }] }),
    JSON.stringify({ ...summary, daily: [{ ...summary.daily[0], date: "2026-09-07" }] }),
    JSON.stringify({ ...summary, daily: [summary.daily[0], summary.daily[0]] }),
    JSON.stringify({ ...summary, daily: [] }),
  ])("invalid model JSON/schema/dates → 502", async (output) => {
    generate.mockResolvedValue(output);
    const response = await call();
    expect(response.status).toHaveBeenCalledWith(502);
    expect(response.json).toHaveBeenCalledWith({ error: "Summary generation failed" });
    expect(logError).toHaveBeenCalledWith("Report summary generation or output validation failed");
  });
  it("Vertex AI failure → 502 without leaking internal errors", async () => {
    generate.mockRejectedValue(new Error("sensitive upstream details"));
    const response = await call();
    expect(response.status).toHaveBeenCalledWith(502);
    expect(JSON.stringify([response.json.mock.calls, logError.mock.calls])).not.toContain("sensitive");
  });
  it("server configuration error → 500", async () => {
    generate.mockRejectedValue(new ServerConfigurationError("Missing project ID"));
    expect((await call()).status).toHaveBeenCalledWith(500);
    expect(logError).toHaveBeenCalledWith("Missing project ID");
  });
  it("missing runtime project before token verification → 500", async () => {
    verifyIdToken.mockRejectedValue(new ServerConfigurationError("Missing runtime project ID"));
    expect((await call()).status).toHaveBeenCalledWith(500);
    expect(generate).not.toHaveBeenCalled();
  });
  it("no work days accepts an empty daily array", async () => {
    const input = createReportSummaryInput(createReportData([], calculateReportPeriods("2026-09-07", 7)!, new Map()), false);
    generate.mockResolvedValue(JSON.stringify({ ...summary, daily: [] }));
    expect((await call({ input })).status).toHaveBeenCalledWith(200);
  });
});

describe("request validation", () => {
  it.each([
    ["target", null], ["comparison", []], ["comparisons", {}], ["libraries", {}],
    ["additionalContext", []], ["additionalContext", { uid: "private" }],
  ])("rejects malformed %s", (key, value) => {
    expect(() => parseReportSummaryRequest({ input: { ...inputFixture(), [key]: value } })).toThrow();
  });
  it.each(["target", "comparison"] as const)("validates nested fields in %s", (key) => {
    const input = inputFixture();
    const malformed = [
      { ...input[key], period: { ...input[key].period, days: "7" } },
      { ...input[key], period: { ...input[key].period, startDate: "2026-02-30" } },
      { ...input[key], metrics: { ...input[key].metrics, workDays: null } },
      { ...input[key], metrics: { ...input[key].metrics, fatigueScore: Infinity } },
      ...[{ date: 7 }, { date: "2027-01-01" }, { workText: null }, { stayMinutes: "120" }, { libraries: [1] }, { uid: "private" }]
        .map((fields) => ({ ...input[key], days: [{ ...input[key].days[0], ...fields }] })),
      { ...input[key], days: [input[key].days[0], input[key].days[0]] },
    ];
    for (const value of malformed) {
      expect(() => parseReportSummaryRequest({ input: { ...input, [key]: value } })).toThrow();
    }
  });
  it("validates comparison values and library metrics", () => {
    const input = inputFixture();
    expect(() => parseReportSummaryRequest({ input: { ...input, comparisons: { ...input.comparisons, workDays: { difference: "1", assessment: "improved" } } } })).toThrow();
    expect(() => parseReportSummaryRequest({ input: { ...input, libraries: [{ ...input.libraries[0], libraryName: 1 }] } })).toThrow();
  });
});
