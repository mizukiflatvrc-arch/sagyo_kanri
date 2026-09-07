import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionForm } from "./SessionForm";
import { TimecardReportForm } from "./TimecardReportForm";
import { createEmptySessionFormValues } from "../utils/format";
import type { Library, SessionFormValues } from "../types";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const library: Library = {
  id: "library-1", userId: "user-1", name: "図書館", googleMapsUrl: "",
  createdAt: new Date(), updatedAt: new Date(),
};
function initialValues(): SessionFormValues {
  return {
    ...createEmptySessionFormValues(), libraryId: library.id,
    enteredAt: "2026-08-01T10:00", exitedAt: "2026-08-01T12:00",
  };
}

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 0; });
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

function textarea(selector: string, value: string) {
  const element = container.querySelector<HTMLTextAreaElement>(selector)!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
function submit() {
  act(() => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
}
function radio(value: string) {
  return container.querySelector<HTMLInputElement>(`input[name="completionStatus"][value="${value}"]`);
}

describe.each(["manual", "timecard"] as const)("%s optional plan UI", (route) => {
  function render() {
    const onSubmit = vi.fn();
    const props = { initialValues: initialValues(), libraries: [library], isSaving: false, onSubmit, onCancel: vi.fn() };
    act(() => root.render(route === "manual" ? <SessionForm {...props} mode="create" /> : <TimecardReportForm {...props} />));
    return onSubmit;
  }

  it("retains details and saves without a plan; adding a plan requires an explicit completion choice", () => {
    const onSubmit = render();
    expect(container.querySelector("details textarea")).not.toBeNull();
    expect(container.textContent).not.toContain("予定タスクを作成しましたか");
    expect(radio("not_planned")?.checked).toBe(true);
    expect(radio("on_schedule")).toBeNull();
    submit();
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ plannedTaskCreated: false, plannedTaskText: "", completionStatus: "not_planned" });
    onSubmit.mockClear();

    textarea("details textarea", "仕様書を書く");
    expect(radio("not_planned")).toBeNull();
    expect(container.querySelectorAll('input[name="completionStatus"]')).toHaveLength(3);
    submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("終了状況を選択");
    act(() => radio("mostly_on_schedule")!.click());
    submit();
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ plannedTaskCreated: true, plannedTaskText: "仕様書を書く", completionStatus: "mostly_on_schedule" });
  });

  it("clearing the plan returns to not_planned and hides scheduled choices", () => {
    const onSubmit = render();
    textarea("details textarea", "仕様書を書く");
    act(() => radio("on_schedule")!.click());
    textarea("details textarea", "   ");
    expect(radio("on_schedule")).toBeNull();
    expect(radio("not_planned")?.checked).toBe(true);
    submit();
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ plannedTaskCreated: false, plannedTaskText: "", completionStatus: "not_planned" });
  });
});

describe("existing session form", () => {
  it.each([true, false])("preserves historical flag %s and status for unrelated edits, even after props refresh", (plannedTaskCreated) => {
    const onSubmit = vi.fn();
    const values = { ...initialValues(), plannedTaskCreated, completionStatus: "on_schedule" as const };
    const render = (initialValues: SessionFormValues) => act(() => root.render(
      <SessionForm initialValues={initialValues} libraries={[library]} mode="edit" isSaving={false} onSubmit={onSubmit} onCancel={vi.fn()} />,
    ));
    render(values);
    expect(radio("on_schedule")?.checked).toBe(true);
    textarea('textarea[name="actualTaskText"]', "実装した");
    textarea('textarea[name="note"]', "メモ");
    render({ ...values, plannedTaskText: "別画面の最新予定", completionStatus: "off_schedule" });
    submit();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      plannedTaskCreated, plannedTaskText: "", completionStatus: "on_schedule", actualTaskText: "実装した", note: "メモ",
    }), {});
  });

  it("sends explicit plan edits separately from unrelated values", () => {
    const onSubmit = vi.fn();
    act(() => root.render(<SessionForm
      initialValues={initialValues()} libraries={[library]} mode="edit"
      isSaving={false} onSubmit={onSubmit} onCancel={vi.fn()}
    />));
    textarea("details textarea", "仕様書を書く");
    act(() => radio("off_schedule")!.click());
    submit();
    expect(onSubmit.mock.calls[0]?.[1]).toEqual({ plannedTaskText: "仕様書を書く", completionStatus: "off_schedule" });
  });
});
