import type { ReportSummaryInput } from "../../src/report/types";

export interface ReportSummaryProvider {
  // Return untrusted JSON text. The handler validates the shape and report
  // dates before any provider output becomes application data.
  generate(input: ReportSummaryInput): Promise<string | undefined>;
}

export class ServerConfigurationError extends Error {}
