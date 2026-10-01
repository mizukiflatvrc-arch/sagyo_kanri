import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReportSummaryInput } from "../../src/report/summarizer";
import { calculateReportPeriods, createReportData } from "../../src/utils/report";
import { generateGeminiSummary, REPORT_SUMMARY_SCHEMA } from "../src/gemini";
import { ServerConfigurationError } from "../src/reportSummary";

const mocks = vi.hoisted(() => ({ constructor: vi.fn(), generateContent: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    constructor(options: unknown) { mocks.constructor(options); }
    models = { generateContent: mocks.generateContent };
  },
}));

describe("Gemini Vertex AI adapter", () => {
  const input = createReportSummaryInput(createReportData([], calculateReportPeriods("2026-09-07", 7)!, new Map()), false);
  const config = { project: "runtime-project", location: "global", model: "configured-model" };
  beforeEach(() => vi.resetAllMocks());

  it("uses Vertex ADC, server config and strict JSON schema; sends only report input", async () => {
    mocks.generateContent.mockResolvedValue({ text: "generated JSON" });
    expect(await generateGeminiSummary(input, config)).toBe("generated JSON");
    expect(mocks.constructor).toHaveBeenCalledWith({
      vertexai: true, project: config.project, location: config.location,
      httpOptions: { timeout: 25_000 },
    });
    expect(mocks.generateContent).toHaveBeenCalledWith({
      model: config.model,
      contents: JSON.stringify(input),
      config: {
        systemInstruction: expect.stringContaining("復学・就労の可否を判断しない"),
        responseMimeType: "application/json",
        responseJsonSchema: REPORT_SUMMARY_SCHEMA,
        maxOutputTokens: 2048,
      },
    });
    expect(REPORT_SUMMARY_SCHEMA.required).toEqual(["daily", "workSummary", "noteSummary", "overview"]);
    expect(REPORT_SUMMARY_SCHEMA.additionalProperties).toBe(false);
    expect(REPORT_SUMMARY_SCHEMA.properties.daily.items.required).toEqual(["date", "workSummary", "noteSummary"]);
    expect(REPORT_SUMMARY_SCHEMA.properties.daily.items.additionalProperties).toBe(false);
  });
  it.each([{ project: undefined }, { project: " " }, { model: "" }, { location: "" }])("fails clearly on missing configuration", async (missing) => {
    await expect(generateGeminiSummary(input, { ...config, ...missing })).rejects.toBeInstanceOf(ServerConfigurationError);
    expect(mocks.constructor).not.toHaveBeenCalled();
  });
  it("propagates provider failures to the HTTP boundary", async () => {
    mocks.generateContent.mockRejectedValue(new Error("upstream failure"));
    await expect(generateGeminiSummary(input, config)).rejects.toThrow("upstream failure");
  });
});
