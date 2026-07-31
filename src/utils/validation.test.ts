import { describe, expect, it } from "vitest";
import type { LibrarySession, SessionFormValues } from "../types";
import {
  createEmptySessionFormValues,
  formatMinutes,
  minutesToParts,
  partsToMinutes,
  sessionToFormValues,
} from "./format";
import {
  fromJstDateTimeLocal,
  toJstDateTimeLocal,
} from "./date";
import {
  parseDurationParts,
  parseSessionForm,
  validateLibraryForm,
  validateSessionForm,
} from "./validation";

function validSessionForm(
  overrides: Partial<SessionFormValues> = {},
): SessionFormValues {
  return {
    ...createEmptySessionFormValues(new Date("2026-07-23T00:00:00.000Z")),
    libraryId: "library-1",
    enteredAt: "2026-07-23T09:00",
    exitedAt: "2026-07-23T11:00",
    actualWorkHours: "1",
    actualWorkMinutes: "20",
    selfCriticismScore: 2,
    ...overrides,
  };
}

describe("validateSessionForm", () => {
  it("accepts a valid session including boundary scores", () => {
    const errors = validateSessionForm(
      validSessionForm({
        concentrationScore: 0,
        anxietyScore: 10,
        fatigueScore: 5,
        selfCriticismScore: 0,
      }),
    );

    expect(errors).toEqual({});
  });

  it("requires a library and valid entry/exit order", () => {
    const errors = validateSessionForm(
      validSessionForm({
        libraryId: " ",
        enteredAt: "2026-07-23T11:00",
        exitedAt: "2026-07-23T09:00",
      }),
    );

    expect(errors.libraryId).toBeDefined();
    expect(errors.exitedAt).toBeDefined();
  });

  it("rejects equal entry and exit times", () => {
    const errors = validateSessionForm(
      validSessionForm({
        enteredAt: "2026-07-23T09:00",
        exitedAt: "2026-07-23T09:00",
      }),
    );

    expect(errors.exitedAt).toBeDefined();
  });

  it("rejects work duration longer than the stay", () => {
    const errors = validateSessionForm(
      validSessionForm({
        enteredAt: "2026-07-23T09:00",
        exitedAt: "2026-07-23T10:00",
        actualWorkHours: "1",
        actualWorkMinutes: "1",
      }),
    );

    expect(errors.actualWorkMinutes).toContain("滞在時間以内");
  });

  it("allows zero score and the exact stay duration", () => {
    const errors = validateSessionForm(
      validSessionForm({
        actualWorkHours: "2",
        actualWorkMinutes: "0",
        selfCriticismScore: 0,
      }),
    );

    expect(errors.actualWorkMinutes).toBeUndefined();
    expect(errors.selfCriticismScore).toBeUndefined();
  });

  it.each([
    ["negative", -1],
    ["above ten", 11],
    ["fractional", 5.5],
    ["not finite", Number.NaN],
  ])("rejects a %s score", (_label, score) => {
    const errors = validateSessionForm(
      validSessionForm({
        concentrationScore: score,
        selfCriticismScore: score,
      }),
    );

    expect(errors.concentrationScore).toBeDefined();
    expect(errors.selfCriticismScore).toBeDefined();
  });

  it("rejects invalid calendar dates and malformed duration parts", () => {
    const errors = validateSessionForm(
      validSessionForm({
        enteredAt: "2026-02-30T09:00",
        actualWorkHours: "-1",
        actualWorkMinutes: "60",
      }),
    );

    expect(errors.enteredAt).toBeDefined();
    expect(errors.actualWorkMinutes).toBeDefined();
  });
});

describe("form parsing", () => {
  it("parses duration parts without treating empty values as zero", () => {
    expect(parseDurationParts("1", "20")).toBe(80);
    expect(parseDurationParts("", "20")).toBeNull();
    expect(parseDurationParts("1", "60")).toBeNull();
  });

  it("returns domain Dates and total minutes for valid form values", () => {
    const parsed = parseSessionForm(validSessionForm());

    expect(parsed).not.toBeNull();
    expect(parsed?.enteredAt.toISOString()).toBe("2026-07-23T00:00:00.000Z");
    expect(parsed?.stayMinutes).toBe(120);
    expect(parsed?.actualWorkMinutes).toBe(80);
    expect(parsed?.selfCriticismScore).toBe(2);
  });

  it("returns null for invalid form values", () => {
    expect(parseSessionForm(validSessionForm({ libraryId: "" }))).toBeNull();
  });
});

describe("JST datetime-local conversion", () => {
  it("converts without depending on the runtime local timezone", () => {
    const instant = new Date("2026-07-23T00:15:00.000Z");

    expect(toJstDateTimeLocal(instant)).toBe("2026-07-23T09:15");
    expect(fromJstDateTimeLocal("2026-07-23T09:15")?.toISOString()).toBe(
      "2026-07-23T00:15:00.000Z",
    );
  });

  it("handles a JST calendar-day boundary", () => {
    expect(
      toJstDateTimeLocal(new Date("2026-07-22T15:30:00.000Z")),
    ).toBe("2026-07-23T00:30");
  });
});

describe("duration formatting and form mapping", () => {
  it.each([
    [0, "0分"],
    [20, "20分"],
    [60, "1時間"],
    [80, "1時間20分"],
    [120, "2時間"],
  ])("formats %i minutes as %s", (minutes, expected) => {
    expect(formatMinutes(minutes)).toBe(expected);
  });

  it("converts between total minutes and duration parts", () => {
    expect(minutesToParts(80)).toEqual({ hours: 1, minutes: 20 });
    expect(partsToMinutes(1, 20)).toBe(80);
    expect(partsToMinutes({ hours: 1, minutes: 60 })).toBeNaN();
  });

  it("maps a domain session to JST form values", () => {
    const session: LibrarySession = {
      id: "session-1",
      userId: "user-1",
      libraryId: "library-1",
      enteredAt: new Date("2026-07-23T00:00:00.000Z"),
      exitedAt: new Date("2026-07-23T02:00:00.000Z"),
      stayMinutes: 120,
      actualWorkMinutes: 80,
      concentrationScore: 6,
      anxietyScore: 4,
      fatigueScore: 5,
      selfCriticismScore: 2,
      plannedTaskCreated: true,
      plannedTaskText: "資料を読む",
      actualTaskText: "資料を読んだ",
      completionStatus: "mostly_on_schedule",
      nextDayReaction: "mild",
      nextDayNote: "",
      note: "",
      isLegacyEncrypted: false,
      createdAt: new Date("2026-07-23T03:00:00.000Z"),
      updatedAt: new Date("2026-07-23T03:00:00.000Z"),
    };

    expect(sessionToFormValues(session)).toMatchObject({
      enteredAt: "2026-07-23T09:00",
      exitedAt: "2026-07-23T11:00",
      actualWorkHours: "1",
      actualWorkMinutes: "20",
      selfCriticismScore: 2,
    });
  });
});

describe("validateLibraryForm", () => {
  it("accepts blank optional fields and an https map URL", () => {
    expect(
      validateLibraryForm({
        name: "中央図書館",
        googleMapsUrl: "https://maps.google.com/example",
        latitude: "",
        longitude: "",
      }),
    ).toEqual({});
  });

  it("validates the name, URL scheme, latitude, and longitude", () => {
    const errors = validateLibraryForm({
      name: "",
      googleMapsUrl: "javascript:alert(1)",
      latitude: "91",
      longitude: "-181",
    });

    expect(errors.name).toBeDefined();
    expect(errors.googleMapsUrl).toBeDefined();
    expect(errors.latitude).toBeDefined();
    expect(errors.longitude).toBeDefined();
  });
});
