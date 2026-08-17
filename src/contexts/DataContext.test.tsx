import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  user: { uid: "user-1" },
  subscribeLibraries: vi.fn(),
  subscribeSessions: vi.fn(),
  subscribeActiveSession: vi.fn(),
}));

vi.mock("./AuthContext", () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock("../services/libraries", () => ({
  subscribeLibraries: mocks.subscribeLibraries,
}));

vi.mock("../services/sessions", () => ({
  subscribeSessions: mocks.subscribeSessions,
}));

vi.mock("../services/activeSessions", () => ({
  subscribeActiveSession: mocks.subscribeActiveSession,
}));

import { DataProvider, useData } from "./DataContext";

function Probe() {
  const {
    libraries,
    sessions,
    activeSession,
    isLoading,
    error,
    isActiveSessionLoading,
    activeSessionError,
  } = useData();
  return (
    <pre>
      {JSON.stringify({
        libraries: libraries.length,
        sessions: sessions.length,
        hasActiveSession: activeSession !== null,
        isLoading,
        error,
        isActiveSessionLoading,
        activeSessionError,
      })}
    </pre>
  );
}

describe("DataProvider", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.subscribeLibraries.mockImplementation(
      (_userId, onData: (items: unknown[]) => void) => {
        onData([]);
        return vi.fn();
      },
    );
    mocks.subscribeSessions.mockImplementation(
      (_userId, onData: (items: unknown[]) => void) => {
        onData([]);
        return vi.fn();
      },
    );
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function renderedState() {
    return JSON.parse(container.textContent ?? "{}") as {
      isLoading: boolean;
      error: string | null;
      isActiveSessionLoading: boolean;
      activeSessionError: string | null;
      hasActiveSession: boolean;
    };
  }

  it("activeSessionだけが権限拒否でも既存データを利用可能にする", () => {
    mocks.subscribeActiveSession.mockImplementation(
      (
        _userId,
        _onData: (item: unknown) => void,
        onError: (error: Error & { code?: string }) => void,
      ) => {
        const error = Object.assign(new Error("permission denied"), {
          code: "permission-denied",
        });
        onError(error);
        return vi.fn();
      },
    );

    act(() => {
      root.render(
        <DataProvider>
          <Probe />
        </DataProvider>,
      );
    });

    expect(renderedState()).toMatchObject({
      isLoading: false,
      error: null,
      isActiveSessionLoading: false,
      activeSessionError: "この操作を行う権限がありません。",
      hasActiveSession: false,
    });
  });

  it("activeSessionを正常に購読できる場合はエラーを分離したまま保持する", () => {
    mocks.subscribeActiveSession.mockImplementation(
      (_userId, onData: (item: unknown) => void) => {
        onData({
          userId: "user-1",
          enteredAt: new Date("2026-07-31T01:00:00.000Z"),
          createdAt: new Date("2026-07-31T01:00:00.000Z"),
          updatedAt: new Date("2026-07-31T01:00:00.000Z"),
        });
        return vi.fn();
      },
    );

    act(() => {
      root.render(
        <DataProvider>
          <Probe />
        </DataProvider>,
      );
    });

    expect(renderedState()).toMatchObject({
      isLoading: false,
      error: null,
      isActiveSessionLoading: false,
      activeSessionError: null,
      hasActiveSession: true,
    });
  });
});
