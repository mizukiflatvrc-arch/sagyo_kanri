import { describe, expect, it } from "vitest";
import { isLegacyEncryptedRecord } from "./legacyRecords";

describe("legacy record detection", () => {
  it("旧バージョン番号を持つ記録を検出する", () => {
    expect(isLegacyEncryptedRecord({ encryptionVersion: 1 })).toBe(true);
  });

  it("旧暗号文を含む記録を検出する", () => {
    expect(
      isLegacyEncryptedRecord({
        note: "hibi:e1:MTIzNDU2Nzg5MDEy:ciphertext",
      }),
    ).toBe(true);
  });

  it("通常の平文記録は旧形式として扱わない", () => {
    expect(
      isLegacyEncryptedRecord({
        plannedTaskText: "資料を読む",
        actualTaskText: "資料を読んだ",
        nextDayNote: "",
        note: "集中できた",
      }),
    ).toBe(false);
  });
});
