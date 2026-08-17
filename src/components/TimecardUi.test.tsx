import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActiveSession } from "../types/activeSession";
import type { Library } from "../types";
import { ActiveSessionCard } from "./ActiveSessionCard";
import { TimecardReportForm } from "./TimecardReportForm";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

describe("タイムカードUI", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T03:00:00.000Z"));
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  function renderCard(activeSession: ActiveSession | null, disabled = false) {
    act(() => {
      root.render(
        <ActiveSessionCard
          activeSession={activeSession}
          isProcessing={disabled}
          onEnter={vi.fn()}
          onExit={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
    });
  }

  it("activeSessionがない場合は入室ボタンを表示する", () => {
    renderCard(null);
    expect(container.textContent).toContain("入室する");
    expect(container.textContent).not.toContain("退出して日報を書く");
  });

  it("処理中は入室ボタンを無効にする", () => {
    renderCard(null, true);
    expect(
      container.querySelector<HTMLButtonElement>("button")?.disabled,
    ).toBe(true);
  });

  it("入室中カードと日またぎ警告を表示する", () => {
    renderCard({
      userId: "user-1",
      enteredAt: new Date("2026-07-31T01:00:00.000Z"),
      createdAt: new Date("2026-07-31T01:00:00.000Z"),
      updatedAt: new Date("2026-07-31T01:00:00.000Z"),
    });
    expect(container.textContent).toContain("入室中");
    expect(container.textContent).toContain("退出して日報を書く");
    expect(container.textContent).toContain("前日から入室中");
    expect(container.textContent).toContain("入室記録を取り消す");
  });

  it("退出時刻がある場合は日報再開を表示する", () => {
    renderCard({
      userId: "user-1",
      enteredAt: new Date("2026-08-01T01:00:00.000Z"),
      exitStartedAt: new Date("2026-08-01T02:00:00.000Z"),
      createdAt: new Date("2026-08-01T01:00:00.000Z"),
      updatedAt: new Date("2026-08-01T02:00:00.000Z"),
    });
    expect(container.textContent).toContain("日報入力を再開する");
  });

  it("新しい日報フォームは自己否定も10段階で入力し、実作業時間を求めない", () => {
    const library: Library = {
      id: "library-1",
      userId: "user-1",
      name: "中央図書館",
      googleMapsUrl: "",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    act(() => {
      root.render(
        <TimecardReportForm
          initialValues={{
            libraryId: "",
            enteredAt: "2026-08-01T10:00",
            exitedAt: "2026-08-01T12:00",
            concentrationScore: 5,
            anxietyScore: 5,
            fatigueScore: 5,
            selfCriticismScore: 0,
            plannedTaskCreated: false,
            plannedTaskText: "",
            actualTaskText: "",
            completionStatus: "on_schedule",
            note: "",
          }}
          libraries={[library]}
          isSaving={false}
          onSubmit={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
    });
    expect(container.textContent).toContain("自己否定の割合");
    expect(container.textContent).toContain("0 / 10");
    expect(container.textContent).not.toContain("実作業時間");
  });
});
