import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerConfigurationError } from "../src/reportSummaryProvider";
import { createReportSummaryProvider } from "../src/reportSummaryProviderFactory";
import { VertexGeminiProvider } from "../src/vertexGeminiProvider";

const mocks = vi.hoisted(() => ({ constructor: vi.fn() }));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    constructor(options: unknown) { mocks.constructor(options); }
  },
}));

describe("report summary provider factory", () => {
  const config = { project: "runtime-project", location: "global", model: "configured-model" };
  beforeEach(() => vi.resetAllMocks());

  it("creates vertex-gemini with its provider-specific configuration", () => {
    const vertexGemini = vi.fn(() => config);
    const provider = createReportSummaryProvider("vertex-gemini", { vertexGemini });
    expect(provider).toBeInstanceOf(VertexGeminiProvider);
    expect(vertexGemini).toHaveBeenCalledExactlyOnceWith();
    // Credentials and the SDK client are needed only when generation starts.
    expect(mocks.constructor).not.toHaveBeenCalled();
  });

  it.each(["unknown", "", "local-llm", "sensitive-configuration-value"])("rejects unsupported provider %s before reading provider settings", (name) => {
    const vertexGemini = vi.fn(() => config);
    expect(() => createReportSummaryProvider(name, { vertexGemini })).toThrow(ServerConfigurationError);
    expect(() => createReportSummaryProvider(name, { vertexGemini })).toThrow("Unsupported REPORT_SUMMARIZER_PROVIDER");
    expect(vertexGemini).not.toHaveBeenCalled();
    expect(mocks.constructor).not.toHaveBeenCalled();
  });
});
