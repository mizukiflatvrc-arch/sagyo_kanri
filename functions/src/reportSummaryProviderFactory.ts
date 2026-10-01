import { ServerConfigurationError, type ReportSummaryProvider } from "./reportSummaryProvider";
import { VertexGeminiProvider, type VertexGeminiConfiguration } from "./vertexGeminiProvider";

export function createReportSummaryProvider(
  providerName: string,
  configuration: { vertexGemini: () => VertexGeminiConfiguration },
): ReportSummaryProvider {
  switch (providerName) {
    case "vertex-gemini":
      return new VertexGeminiProvider(configuration.vertexGemini());
    default:
      throw new ServerConfigurationError("Unsupported REPORT_SUMMARIZER_PROVIDER");
  }
}
