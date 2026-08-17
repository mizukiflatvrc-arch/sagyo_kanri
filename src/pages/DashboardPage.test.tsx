import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const dataState = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { uid: "user-1" } }),
}));

vi.mock("../contexts/ToastContext", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("../contexts/DataContext", () => ({
  useData: () => dataState.current,
}));

function activeDataState() {
  return {
    sessions: [],
    libraries: [],
    libraryById: new Map(),
    activeSession: {
      userId: "user-1",
      enteredAt: new Date("2026-07-31T01:00:00.000Z"),
      exitStartedAt: new Date("2026-07-31T02:00:00.000Z"),
      createdAt: new Date("2026-07-31T01:00:00.000Z"),
      updatedAt: new Date("2026-07-31T02:00:00.000Z"),
    },
    isLoading: false,
    error: null,
    isActiveSessionLoading: false,
    activeSessionError: null,
  };
}

vi.mock("../services/activeSessions", () => ({
  startActiveSession: vi.fn(),
  startActiveSessionExit: vi.fn(),
  cancelActiveSession: vi.fn(),
}));

describe("DashboardPageのタイムカード", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container?.remove();
    root = null;
    container = null;
  });

  it("日報入力中の取消では確認と明確な警告を表示する", () => {
    dataState.current = activeDataState();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <MemoryRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <DashboardPage />
        </MemoryRouter>,
      );
    });

    const cancelButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.includes("入室記録を取り消す"),
    );
    expect(cancelButton).toBeDefined();
    act(() => cancelButton?.click());

    expect(container.textContent).toContain("入室記録を取り消しますか？");
    expect(container.textContent).toContain(
      "日報入力途中の内容が失われる可能性があります",
    );
  });

  it("activeSessionだけが権限拒否でもホームの既存機能を表示する", () => {
    dataState.current = {
      ...activeDataState(),
      activeSession: null,
      activeSessionError: "この操作を行う権限がありません。",
    };
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <MemoryRouter
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <DashboardPage />
        </MemoryRouter>,
      );
    });

    expect(container.textContent).toContain(
      "入退室機能を読み込めませんでした",
    );
    expect(container.textContent).toContain("直近30日の記録");
    expect(container.textContent).toContain("過去の記録を追加");
    expect(container.textContent).not.toContain("入室する");
  });
});
