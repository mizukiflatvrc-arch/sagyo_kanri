import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "./contexts/ToastContext";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

describe("App", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    container?.remove();
    vi.unstubAllEnvs();
    vi.resetModules();
    root = null;
    container = null;
  });

  it("Firebase未設定時もクラッシュせず設定案内を表示する", async () => {
    vi.stubEnv("VITE_FIREBASE_API_KEY", "");
    vi.resetModules();
    const [{ App }, { AuthProvider }, { EncryptionProvider }] = await Promise.all([
      import("./App"),
      import("./contexts/AuthContext"),
      import("./contexts/EncryptionContext"),
    ]);

    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <MemoryRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <ToastProvider>
            <AuthProvider>
              <EncryptionProvider>
                <App />
              </EncryptionProvider>
            </AuthProvider>
          </ToastProvider>
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain("Firebaseの設定が必要です");
    expect(container.textContent).toContain("Firestore Security Rules");
  });
});
