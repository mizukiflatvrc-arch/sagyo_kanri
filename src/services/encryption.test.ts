import { describe, expect, it } from "vitest";
import {
  DecryptionError,
  decryptText,
  encryptText,
  isEncryptedText,
} from "./encryption";

async function createTestKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

describe("client-side field encryption", () => {
  it("AES-GCMで暗号化した本文だけを同じ鍵と文脈で復号できる", async () => {
    const key = await createTestKey();
    const ciphertext = await encryptText("資料を3ページ読む", key, "user|planned");

    expect(isEncryptedText(ciphertext)).toBe(true);
    expect(ciphertext).not.toContain("資料を3ページ読む");
    await expect(decryptText(ciphertext, key, "user|planned")).resolves.toBe(
      "資料を3ページ読む",
    );
    await expect(
      decryptText(ciphertext, key, "user|different-field"),
    ).rejects.toBeInstanceOf(DecryptionError);
  });

  it("移行前の平文は互換読み込みできる", async () => {
    const key = await createTestKey();
    await expect(decryptText("移行前メモ", key, "user|note")).resolves.toBe(
      "移行前メモ",
    );
  });
});
