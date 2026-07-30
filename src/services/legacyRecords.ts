import type { DocumentData } from "firebase/firestore";

const LEGACY_CIPHERTEXT_PREFIX = "hibi:e1:";
const LEGACY_TEXT_FIELDS = [
  "plannedTaskText",
  "actualTaskText",
  "nextDayNote",
  "note",
] as const;

export const LEGACY_RECORD_MESSAGE =
  "この記録は旧暗号化形式のため、現在のバージョンでは読み込めません";

export function isLegacyEncryptedRecord(data: DocumentData): boolean {
  return (
    data.encryptionVersion === 1 ||
    LEGACY_TEXT_FIELDS.some((field) => {
      const value = data[field];
      return (
        typeof value === "string" &&
        value.startsWith(LEGACY_CIPHERTEXT_PREFIX)
      );
    })
  );
}
