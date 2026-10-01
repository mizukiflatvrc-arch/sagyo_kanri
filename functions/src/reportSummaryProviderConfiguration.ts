import { defineString } from "firebase-functions/params";
import type { ReportSummaryProvider } from "./reportSummaryProvider";
import { createReportSummaryProvider } from "./reportSummaryProviderFactory";

const summarizerProvider = defineString("REPORT_SUMMARIZER_PROVIDER", { default: "vertex-gemini" });
const geminiModel = defineString("GEMINI_MODEL", { default: "gemini-3.5-flash" });
const vertexLocation = defineString("VERTEX_LOCATION", { default: "global" });

export function createConfiguredReportSummaryProvider(project: string | undefined): ReportSummaryProvider {
  return createReportSummaryProvider(summarizerProvider.value(), {
    vertexGemini: () => ({
      project,
      model: geminiModel.value(),
      location: vertexLocation.value(),
    }),
  });
}
