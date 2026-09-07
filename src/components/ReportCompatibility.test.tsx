import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LibrarySession } from "../types";
import { createEmptySessionFormValues, sessionToFormValues } from "../utils/format";
import { parseSessionForm } from "../utils/validation";
import { SessionForm } from "./SessionForm";
import { SessionDetailPage } from "../pages/SessionDetailPage";
import { SessionsPage } from "../pages/SessionsPage";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const dataState = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("../contexts/DataContext", () => ({ useData: () => dataState.current }));
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ user: { uid: "user-1" } }) }));
vi.mock("../contexts/ToastContext", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

const library = {
  id: "library-1", userId: "user-1", name: "中央図書館", googleMapsUrl: "",
  createdAt: new Date("2026-08-01T03:00:00Z"),
  updatedAt: new Date("2026-08-01T03:00:00Z"),
};

function session(overrides: Partial<LibrarySession> = {}): LibrarySession {
  return {
    ...parseSessionForm({
      ...createEmptySessionFormValues(),
      libraryId: library.id,
      enteredAt: "2026-08-01T10:00",
      exitedAt: "2026-08-01T12:00",
    })!,
    id: "session-1", userId: "user-1", isLegacyEncrypted: false,
    createdAt: library.createdAt, updatedAt: library.updatedAt,
    ...overrides,
  };
}

describe("日報の新旧データ表示・編集", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    dataState.current = {
      libraries: [library], libraryById: new Map([[library.id, library]]),
      isLoading: false, error: null, sessions: [],
    };
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it.each(["not_planned", "on_schedule", "mostly_on_schedule", "off_schedule"] as const)(
    "%s の記録を予定入力なしで編集・送信できる",
    (completionStatus) => {
      const oldSession = session({
        completionStatus,
        plannedTaskCreated: completionStatus !== "not_planned",
        plannedTaskText: completionStatus === "not_planned" ? "" : "  資料を読む\n",
      });
      const onSubmit = vi.fn();
      act(() => root.render(
        <SessionForm
          initialValues={sessionToFormValues(oldSession)} libraries={[library]}
          mode="edit" isSaving={false} onSubmit={onSubmit} onCancel={vi.fn()}
        />,
      ));
      expect(container.textContent).toContain("今日やったこと");
      for (const field of ["plannedTaskCreated", "plannedTaskText", "completionStatus"]) {
        expect(container.querySelector(`[name="${field}"]`)).toBeNull();
      }
      const details = container.querySelector("details");
      if (completionStatus === "not_planned") {
        expect(details).toBeNull();
      } else {
        expect(details?.open).toBe(false);
        expect(details?.textContent).toContain("以前の予定・比較記録");
        expect(details?.textContent).toContain("  資料を読む\n");
      }
      act(() => container.querySelector<HTMLButtonElement>('button[type="submit"]')?.click());
      expect(onSubmit).toHaveBeenCalledOnce();
      expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
        plannedTaskCreated: oldSession.plannedTaskCreated,
        plannedTaskText: oldSession.plannedTaskText,
        completionStatus,
        actualTaskText: "",
      });
    },
  );

  it.each(["not_planned", "mostly_on_schedule"] as const)(
    "%s の詳細で作業内容を中心に表示し、以前の予定は補足として残す",
    (completionStatus) => {
      dataState.current.sessions = [session({
        completionStatus,
        actualTaskText: "コードを書いた、仕様書を作った",
        plannedTaskCreated: completionStatus !== "not_planned",
        plannedTaskText: completionStatus === "not_planned" ? "" : "資料を読む",
      })];
      act(() => root.render(
        <MemoryRouter initialEntries={["/sessions/session-1"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes><Route path="/sessions/:sessionId" element={<SessionDetailPage />} /></Routes>
        </MemoryRouter>,
      ));
      expect(container.textContent).toContain("今日やったこと");
      expect(container.textContent).toContain("コードを書いた、仕様書を作った");
      if (completionStatus === "not_planned") {
        expect(container.textContent).toContain("予定なし");
        expect(container.textContent).not.toContain("予定どおり");
        expect(container.querySelector("details")).toBeNull();
      } else {
        expect(container.querySelector("details")?.textContent).toContain("資料を読む");
        expect(container.querySelector("details")?.textContent).toContain("おおむね予定どおり");
      }
    },
  );

  it("一覧で予定なしを選んで新形式だけを絞り込める", () => {
    dataState.current.sessions = [session(), session({ id: "old-session", completionStatus: "on_schedule" })];
    act(() => root.render(
      <MemoryRouter initialEntries={["/sessions?completion=not_planned"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <SessionsPage />
      </MemoryRouter>,
    ));
    expect(container.querySelector<HTMLSelectElement>("#filter-completion")?.value).toBe("not_planned");
    expect(container.querySelector('a[href="/sessions/session-1"]')).not.toBeNull();
    expect(container.querySelector('a[href="/sessions/old-session"]')).toBeNull();
    expect(container.querySelector(".status-badge--completion-not-planned")?.classList.contains("status-badge--neutral")).toBe(true);
  });
});
