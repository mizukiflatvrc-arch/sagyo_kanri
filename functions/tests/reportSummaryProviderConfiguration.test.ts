import { beforeEach, describe, expect, it, vi } from "vitest";
import { createReportSummaryInput } from "../../src/report/summarizer";
import { calculateReportPeriods, createReportData } from "../../src/utils/report";
import { ServerConfigurationError } from "../src/reportSummaryProvider";
import { createConfiguredReportSummaryProvider } from "../src/reportSummaryProviderConfiguration";
import { VertexGeminiProvider } from "../src/vertexGeminiProvider";

const mocks = vi.hoisted(() => ({
  defaults: {} as Record<string, string>,
  values: {} as Record<string, string>,
  readValue: vi.fn(),
  constructor: vi.fn(),
  generateContent: vi.fn(),
}));
vi.mock("firebase-functions/params", () => ({
  defineString: (name: string, options: { default: string }) => {
    mocks.defaults[name] = options.default;
    return {
      value: () => {
        mocks.readValue(name);
        return mocks.values[name] ?? options.default;
      },
    };
  },
}));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    constructor(options: unknown) { mocks.constructor(options); }
    models = { generateContent: mocks.generateContent };
  },
}));

const moduleLoadValueReads = mocks.readValue.mock.calls.length;
const moduleLoadClientCreations = mocks.constructor.mock.calls.length;

describe("server-side report summary provider configuration", () => {
  const input = createReportSummaryInput(createReportData([], calculateReportPeriods("2026-09-07", 7)!, new Map()), false);
  beforeEach(() => {
    mocks.values = {};
    mocks.readValue.mockClear();
    mocks.constructor.mockClear();
    mocks.generateContent.mockReset();
    mocks.generateContent.mockResolvedValue({ text: "generated JSON" });
  });

  it("does not read parameter values or create a provider client at module load", () => {
    expect(moduleLoadValueReads).toBe(0);
    expect(moduleLoadClientCreations).toBe(0);
  });

  it("defaults to Vertex Gemini with the existing model and location", async () => {
    expect(mocks.defaults).toEqual({
      REPORT_SUMMARIZER_PROVIDER: "vertex-gemini",
      GEMINI_MODEL: "gemini-3.5-flash",
      VERTEX_LOCATION: "global",
    });
    const provider = createConfiguredReportSummaryProvider("runtime-project");
    expect(provider).toBeInstanceOf(VertexGeminiProvider);
    expect(mocks.readValue.mock.calls).toEqual([
      ["REPORT_SUMMARIZER_PROVIDER"], ["GEMINI_MODEL"], ["VERTEX_LOCATION"],
    ]);
    expect(await provider.generate(input)).toBe("generated JSON");
    expect(mocks.constructor).toHaveBeenCalledWith({
      vertexai: true, project: "runtime-project", location: "global",
      httpOptions: { timeout: 25_000 },
    });
    expect(mocks.generateContent).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-3.5-flash" }));
  });

  it("reads configured provider, Gemini model and Vertex location at request time", async () => {
    mocks.values = {
      REPORT_SUMMARIZER_PROVIDER: "vertex-gemini",
      GEMINI_MODEL: "configured-model",
      VERTEX_LOCATION: "configured-location",
    };
    await createConfiguredReportSummaryProvider("configured-project").generate(input);
    expect(mocks.constructor).toHaveBeenCalledWith({
      vertexai: true, project: "configured-project", location: "configured-location",
      httpOptions: { timeout: 25_000 },
    });
    expect(mocks.generateContent).toHaveBeenCalledWith(expect.objectContaining({ model: "configured-model" }));
  });

  it("rejects an unknown configured provider without reading Gemini settings", () => {
    mocks.values.REPORT_SUMMARIZER_PROVIDER = "sensitive-unknown-provider";
    expect(() => createConfiguredReportSummaryProvider("runtime-project")).toThrow(ServerConfigurationError);
    expect(mocks.readValue.mock.calls).toEqual([["REPORT_SUMMARIZER_PROVIDER"]]);
    expect(mocks.constructor).not.toHaveBeenCalled();
  });
});
