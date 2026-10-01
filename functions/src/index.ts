import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { error as logError } from "firebase-functions/logger";
import { onRequest } from "firebase-functions/v2/https";
import { createReportSummaryHandler } from "./reportSummary";
import { ServerConfigurationError } from "./reportSummaryProvider";
import { createConfiguredReportSummaryProvider } from "./reportSummaryProviderConfiguration";

const app = getApps()[0] ?? initializeApp();

function runtimeProjectId(): string {
  const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || app.options.projectId;
  if (!project?.trim()) {
    throw new ServerConfigurationError("Report summary requires a runtime Google Cloud project ID");
  }
  return project;
}

export const reportSummary = onRequest({
  region: "asia-northeast1",
  invoker: "public",
  timeoutSeconds: 60,
  memory: "256MiB",
}, createReportSummaryHandler({
  verifyIdToken: (token) => {
    runtimeProjectId();
    return getAuth(app).verifyIdToken(token);
  },
  getProvider: () => createConfiguredReportSummaryProvider(runtimeProjectId()),
  logError,
}));
