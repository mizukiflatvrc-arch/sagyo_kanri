import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { error as logError } from "firebase-functions/logger";
import { defineString } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";
import { generateGeminiSummary } from "./gemini";
import { createReportSummaryHandler, ServerConfigurationError } from "./reportSummary";

const app = getApps()[0] ?? initializeApp();
const geminiModel = defineString("GEMINI_MODEL", { default: "gemini-3.5-flash" });
const vertexLocation = defineString("VERTEX_LOCATION", { default: "global" });

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
  generate: (input) => generateGeminiSummary(input, {
    project: runtimeProjectId(),
    location: vertexLocation.value(),
    model: geminiModel.value(),
  }),
  logError,
}));
