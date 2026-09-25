import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReportSummaryInput, parseReportSummary } from "../../src/report/summarizer";
import type { ReportSummaryInput } from "../../src/report/types";
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

function periodFixture(days: number) {
  return createReportSummaryInput(
    createReportData([], calculateReportPeriods("2026-09-07", days)!, new Map()),
    false,
  );
}

function withDayChange(
  key: "target" | "comparison",
  change: (day: ReportSummaryInput["target"]["days"][number]) => ReportSummaryInput["target"]["days"][number],
): ReportSummaryInput {
  const input = inputFixture();
  return { ...input, [key]: { ...input[key], days: input[key].days.map((day, index) => index === 0 ? change(day) : day) } };
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

  async function expectBadRequest(input: ReportSummaryInput) {
    generate.mockClear();
    const response = await call({ input });
    expect(response.status).toHaveBeenCalledWith(400);
    expect(generate).not.toHaveBeenCalled();
  }

  it("accepts 30-day target and comparison periods", async () => {
    generate.mockResolvedValue(JSON.stringify({ ...summary, daily: [] }));
    expect((await call({ input: periodFixture(30) })).status).toHaveBeenCalledWith(200);
  });

  it.each(["target", "comparison"] as const)("rejects %s period longer than 30 days", async (key) => {
    const input = inputFixture();
    await expectBadRequest({ ...input, [key]: periodFixture(31)[key] });
  });

  it.each(["target", "comparison"] as const)("rejects %s.days longer than 30 entries", async (key) => {
    const input = inputFixture();
    const extended = periodFixture(31)[key];
    await expectBadRequest({
      ...input,
      [key]: { ...extended, period: { ...extended.period, days: 30 } },
    });
  });

  it.each(["target", "comparison"] as const)("requires %s period day count to match its array", async (key) => {
    const input = inputFixture();
    await expectBadRequest({ ...input, [key]: { ...input[key], period: { ...input[key].period, days: 6 } } });
  });

  it.each(["target", "comparison"] as const)("bounds %s workText and noteText at 4000 characters", async (key) => {
    for (const field of ["workText", "noteText"] as const) {
      expect((await call({ input: withDayChange(key, (day) => ({ ...day, [field]: "a".repeat(4000) })) })).status)
        .toHaveBeenCalledWith(200);
      await expectBadRequest(withDayChange(key, (day) => ({ ...day, [field]: "a".repeat(4001) })));
      expect((await call({ input: withDayChange(key, (day) => ({ ...day, [field]: "" })) })).status)
        .toHaveBeenCalledWith(200);
    }
  });

  it.each(["target", "comparison"] as const)("bounds %s day library names and count", async (key) => {
    expect((await call({ input: withDayChange(key, (day) => ({ ...day, libraries: ["a".repeat(200)] })) })).status)
      .toHaveBeenCalledWith(200);
    await expectBadRequest(withDayChange(key, (day) => ({ ...day, libraries: ["a".repeat(201)] })));
    await expectBadRequest(withDayChange(key, (day) => ({ ...day, libraries: Array(21).fill("図書館") })));
  });

  it("bounds library names, IDs and total count", async () => {
    const input = inputFixture();
    const library = input.libraries[0]!;
    for (const field of ["libraryName", "libraryId"] as const) {
      expect((await call({ input: { ...input, libraries: [{ ...library, [field]: "a".repeat(200) }] } })).status)
        .toHaveBeenCalledWith(200);
      await expectBadRequest({ ...input, libraries: [{ ...library, [field]: "a".repeat(201) }] });
    }
    await expectBadRequest({ ...input, libraries: Array(101).fill(library) });
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
